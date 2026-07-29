import * as THREE from 'three';
import { clamp, clamp01, damp, lerp, smoothstep, wobble, TAU } from '../core/util.js';

/**
 * Player — first-person body and camera.
 *
 * Camera motion is the cheapest, most under-used horror tool available. Every
 * term here is authored rather than random:
 *
 *  * The bob is a Lissajous figure (2:1 vertical to lateral) with a slight
 *    forward lag, so the head leads into a step instead of pistoning.
 *  * Footfalls fire off the bob phase, never a timer, so audio and motion are
 *    locked together at every speed.
 *  * Breathing amplitude rises with exertion and with fear, and is the only
 *    motion left when standing still — total camera stillness reads as a
 *    paused game.
 *  * Leaning rolls the camera and offsets it laterally with a collision probe,
 *    so peeking round a corner is a real, blockable action.
 *  * Landing compresses the neck spring; being startled kicks it.
 */

const EYE_STAND = 1.63;
const EYE_CROUCH = 0.94;
const BODY_RADIUS = 0.29;
const BODY_HEIGHT = 1.74;

export class Player {
  constructor({ collision, camera, audio = null, bus }) {
    this.collision = collision;
    this.camera = camera;
    this.audio = audio;
    this.bus = bus;

    this.position = new THREE.Vector3(0, 0, 0);   // feet
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.eyeHeight = EYE_STAND;
    this.radius = BODY_RADIUS;
    this.height = BODY_HEIGHT;

    this.crouching = false;
    this.crouchAmt = 0;
    this.sprinting = false;
    this.grounded = true;
    this.groundY = 0;
    this.surface = 'carpet';
    this.waterDepth = 0;

    this.stamina = 1;
    this.fear = 0;          // 0..1 — driven by the director, feeds bob + breath
    this.exertion = 0;
    this.speedScale = 1;
    this.controlEnabled = true;
    this.lookEnabled = true;
    this.frozen = false;

    // --- camera springs ---
    this.bobPhase = 0;
    this.bobAmount = 0;
    this._lastStepPhase = 0;
    this.lean = 0;
    this.leanTarget = 0;
    this.neckOffset = new THREE.Vector3();
    this.neckVel = new THREE.Vector3();
    this.recoil = new THREE.Vector3();   // pitch/yaw/roll kick
    this.recoilVel = new THREE.Vector3();
    this.viewRoll = 0;
    this.fovBase = 66;
    this.fovOffset = 0;
    /**
     * Motion-reduction setting, 0..1, from the settings screen.
     * At 0 the head is still, but lean, the neck spring and landing compression
     * all still work — those are physical responses carrying information, not
     * idle motion, and removing them removes information.
     */
    this.motionScale = 1;

    this.stepDistance = 0;
    this.totalDistance = 0;
    this.noiseLevel = 0;      // what entities can hear this frame
    this._noiseDecay = 0;

    this._tmp = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
  }

  teleport(x, y, z, yaw = this.yaw) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.neckOffset.set(0, 0, 0);
    this.neckVel.set(0, 0, 0);
    this.groundY = y;
    this.grounded = true;
  }

  get eyePosition() {
    return this._tmp.set(
      this.position.x,
      this.position.y + this.eyeHeight + this.neckOffset.y,
      this.position.z);
  }

  /** Directional vectors on the horizontal plane. */
  forward(out = this._fwd) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right(out = this._right) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  /** Emit a noise event entities can hear. `loud` in metres of audible radius. */
  makeNoise(loud) {
    this.noiseLevel = Math.max(this.noiseLevel, loud);
    this._noiseDecay = 0.35;
    this.bus?.emit('player:noise', { position: this.position.clone(), radius: loud });
  }

  /** Camera kick — used by impacts, startles and heavy doors. */
  kick(pitch = 0, yaw = 0, roll = 0, thrust = 0) {
    this.recoilVel.x += pitch;
    this.recoilVel.y += yaw;
    this.recoilVel.z += roll;
    this.neckVel.z += thrust;
  }

  update(dt, input) {
    if (this.frozen) { this._applyCamera(dt); return; }

    // ---- look -----------------------------------------------------------
    if (this.lookEnabled && input) {
      const { dx, dy } = input.lookDelta();
      this.yaw -= dx;
      this.pitch = clamp(this.pitch - dy, -1.48, 1.48);
    }

    // ---- intent ---------------------------------------------------------
    const axis = this.controlEnabled && input ? input.moveAxis() : { x: 0, y: 0 };
    const wantSprint = this.controlEnabled && input?.down('sprint') && axis.y > 0.1 && this.stamina > 0.06;
    const wantCrouch = this.controlEnabled && input?.down('crouch');

    // Crouch is blocked from releasing under low ceilings (vents).
    const headroom = this.collision.ceilingAbove(this.position.x, this.position.z, this.position.y, this.radius) - this.position.y;
    const forcedCrouch = headroom < BODY_HEIGHT - 0.05;
    this.crouching = wantCrouch || forcedCrouch;
    this.crouchAmt = damp(this.crouchAmt, this.crouching ? 1 : 0, 11, dt);
    this.height = lerp(BODY_HEIGHT, 1.02, this.crouchAmt);

    this.sprinting = wantSprint && !this.crouching;

    // ---- speed ----------------------------------------------------------
    const water = clamp01(this.waterDepth / 0.85);
    let speed = lerp(2.15, 3.62, this.sprinting ? 1 : 0);
    speed = lerp(speed, 1.08, this.crouchAmt);
    speed *= 1 - water * 0.42;                 // wading is slow and loud
    speed *= lerp(1, 0.86, clamp01(this.fear * 0.6));
    speed *= this.speedScale;

    // Strafing and backing up are meaningfully slower — it makes retreating
    // from something feel as bad as it should.
    const dirLocal = new THREE.Vector2(axis.x, axis.y);
    if (dirLocal.y < 0) dirLocal.y *= 0.68;
    dirLocal.x *= 0.82;

    this.forward(this._fwd);
    this.right(this._right);
    const wishX = this._right.x * dirLocal.x + this._fwd.x * dirLocal.y;
    const wishZ = this._right.z * dirLocal.x + this._fwd.z * dirLocal.y;
    const wishLen = Math.hypot(wishX, wishZ);
    const targetVX = wishLen > 0 ? (wishX / wishLen) * speed * Math.min(1, wishLen) : 0;
    const targetVZ = wishLen > 0 ? (wishZ / wishLen) * speed * Math.min(1, wishLen) : 0;

    const accel = wishLen > 0.01 ? (this.grounded ? 13 : 2.4) : (this.grounded ? 16 : 1.4);
    this.velocity.x = damp(this.velocity.x, targetVX, accel, dt);
    this.velocity.z = damp(this.velocity.z, targetVZ, accel, dt);

    // ---- gravity / ground ------------------------------------------------
    this.velocity.y -= 19.6 * dt;
    let nextY = this.position.y + this.velocity.y * dt;

    const floor = this.collision.sampleFloor(
      this.position.x + this.velocity.x * dt,
      this.position.z + this.velocity.z * dt,
      this.position.y + 0.45, 0.62);

    const wasGrounded = this.grounded;
    if (floor && nextY <= floor.y + 0.02) {
      const drop = this.velocity.y;
      nextY = floor.y;
      this.velocity.y = 0;
      this.grounded = true;
      this.groundY = floor.y;
      this.surface = floor.surface;
      this.waterDepth = floor.water || 0;
      if (!wasGrounded && drop < -2.2) {
        const f = clamp01(-drop / 9);
        this.neckVel.y -= f * 2.6;
        this.kick(f * 0.06, 0, (Math.random() - 0.5) * f * 0.08);
        this.bus?.emit('player:land', { force: f, surface: this.surface });
        this.makeNoise(6 + f * 8);
      }
    } else {
      this.grounded = false;
      if (!floor) {
        // No floor registered — snap to the last known ground rather than
        // dropping the player out of the world.
        nextY = Math.max(nextY, this.groundY);
        if (nextY <= this.groundY + 0.001) { this.velocity.y = 0; this.grounded = true; }
      }
    }
    this.position.y = nextY;

    // ---- horizontal move + collision -------------------------------------
    const px = this.position.x + this.velocity.x * dt;
    const pz = this.position.z + this.velocity.z * dt;
    const res = this.collision.resolveCapsule(px, this.position.y, pz, this.radius, this.height);
    if (res.hit) {
      // Slide: remove the component of velocity into the surface.
      const vn = this.velocity.x * res.normalX + this.velocity.z * res.normalZ;
      if (vn < 0) {
        this.velocity.x -= res.normalX * vn;
        this.velocity.z -= res.normalZ * vn;
      }
      // A hard scrape against a wall while sprinting is audible.
      if (this.sprinting && vn < -1.6) this.makeNoise(5);
    }
    const moved = Math.hypot(res.x - this.position.x, res.z - this.position.z);
    this.position.x = res.x;
    this.position.z = res.z;

    // ---- stamina ---------------------------------------------------------
    const speedNow = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.sprinting) this.stamina = clamp01(this.stamina - dt * 0.20);
    else this.stamina = clamp01(this.stamina + dt * (speedNow < 0.4 ? 0.18 : 0.085));
    this.exertion = damp(this.exertion, this.sprinting ? 1 : clamp01(speedNow / 3.2) * 0.45, 1.4, dt);

    // ---- footfalls -------------------------------------------------------
    this.stepDistance += speedNow * dt;
    this.totalDistance += speedNow * dt;
    const strideLen = lerp(0.78, 1.06, clamp01(speedNow / 3.6)) * lerp(1, 0.72, this.crouchAmt);
    const bobRate = speedNow > 0.05 ? (speedNow / strideLen) * Math.PI : 0;
    this.bobPhase += bobRate * dt;
    this.bobAmount = damp(this.bobAmount, clamp01(speedNow / 2.4), 7, dt);

    if (this.bobPhase - this._lastStepPhase >= Math.PI) {
      this._lastStepPhase += Math.PI;
      if (speedNow > 0.35) {
        const strength = clamp01(speedNow / 3.4);
        const loud = this.crouching ? 2.2 : this.sprinting ? 11 : 6;
        this.bus?.emit('player:step', {
          surface: this.surface,
          water: this.waterDepth,
          strength,
          crouch: this.crouchAmt > 0.5,
          left: (Math.round(this._lastStepPhase / Math.PI) % 2) === 0,
          position: this.position.clone(),
        });
        this.makeNoise(loud * (this.waterDepth > 0.05 ? 1.5 : 1));
        this.neckVel.y -= strength * 0.22;
      }
    }

    // ---- lean ------------------------------------------------------------
    let leanWant = 0;
    if (this.controlEnabled && input) {
      if (input.down('leanLeft')) leanWant -= 1;
      if (input.down('leanRight')) leanWant += 1;
    }
    // Probe for a wall in the lean direction so we cannot poke through it.
    if (leanWant !== 0) {
      const off = 0.62 * leanWant;
      const tx = this.position.x + this._right.x * off;
      const tz = this.position.z + this._right.z * off;
      const probe = this.collision.resolveCapsule(tx, this.position.y, tz, 0.22, this.height);
      if (probe.hit) leanWant *= 0.25;
    }
    this.leanTarget = leanWant;
    this.lean = damp(this.lean, this.leanTarget, 7.5, dt);

    // ---- noise decay -----------------------------------------------------
    this._noiseDecay -= dt;
    if (this._noiseDecay <= 0) this.noiseLevel = 0;

    this._applyCamera(dt, speedNow);
  }

  _applyCamera(dt, speedNow = 0) {
    // Neck spring — critically damped, driven by footfalls and impacts.
    const k = 82, c = 13.5;
    this.neckVel.y += (-this.neckOffset.y * k - this.neckVel.y * c) * dt;
    this.neckVel.z += (-this.neckOffset.z * k - this.neckVel.z * c) * dt;
    this.neckOffset.y = clamp(this.neckOffset.y + this.neckVel.y * dt, -0.16, 0.10);
    this.neckOffset.z = clamp(this.neckOffset.z + this.neckVel.z * dt, -0.14, 0.14);

    this.recoilVel.multiplyScalar(Math.exp(-9 * dt));
    this.recoil.x = damp(this.recoil.x + this.recoilVel.x * dt, 0, 6, dt);
    this.recoil.y = damp(this.recoil.y + this.recoilVel.y * dt, 0, 6, dt);
    this.recoil.z = damp(this.recoil.z + this.recoilVel.z * dt, 0, 6, dt);

    // Bob: 2:1 Lissajous. Vertical at 2f, lateral at 1f, plus a small roll.
    const a = this.bobAmount * lerp(1, 0.55, this.crouchAmt) * this.motionScale;
    const bobY = Math.sin(this.bobPhase * 2) * 0.026 * a;
    const bobX = Math.sin(this.bobPhase) * 0.030 * a;
    const bobRoll = Math.sin(this.bobPhase) * 0.011 * a;

    // Breathing: slow when calm, shallow and fast when afraid or spent.
    const breathRate = lerp(0.72, 2.55, clamp01(this.exertion * 0.7 + this.fear * 0.8));
    this._breathPhase = (this._breathPhase || 0) + breathRate * dt * TAU * 0.5;
    const breathAmp = lerp(0.0032, 0.0135, clamp01(this.exertion + this.fear * 0.9))
      * lerp(0.35, 1, this.motionScale);
    const breathY = Math.sin(this._breathPhase) * breathAmp;
    // Idle micro-drift stops the camera from ever being perfectly locked.
    const t = performance.now() * 0.001;
    const driftX = wobble(t * 0.21, 3) * 0.0016 * (1 - a * 0.7) * this.motionScale;
    const driftY = wobble(t * 0.17, 8) * 0.0014 * (1 - a * 0.7) * this.motionScale;

    const eyeY = lerp(EYE_STAND, EYE_CROUCH, this.crouchAmt);
    this.eyeHeight = eyeY;

    this.right(this._right);
    this.forward(this._fwd);
    const leanOffset = this.lean * 0.42;
    const cam = this.camera;
    cam.position.set(
      this.position.x + this._right.x * (bobX + leanOffset) + this._fwd.x * this.neckOffset.z,
      this.position.y + eyeY + bobY + breathY + this.neckOffset.y,
      this.position.z + this._right.z * (bobX + leanOffset) + this._fwd.z * this.neckOffset.z);

    this.viewRoll = damp(this.viewRoll,
      -this.lean * 0.185 + bobRoll * this.motionScale + this.recoil.z, 12, dt);
    cam.rotation.set(
      this.pitch + this.recoil.x + driftY,
      this.yaw + this.recoil.y + driftX,
      this.viewRoll,
      'YXZ');

    // A very small FOV lift while sprinting; larger values read as arcade.
    const fovWant = this.fovBase + (this.sprinting ? 3.6 : 0) + this.fovOffset;
    this._fovNow = damp(this._fovNow ?? fovWant, fovWant, 4.5, dt);
    if (Math.abs(cam.fov - this._fovNow) > 0.02) {
      cam.fov = this._fovNow;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
  }
}

export default Player;
