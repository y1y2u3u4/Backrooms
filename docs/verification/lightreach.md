# Light — what is planned, what is delivered, what you can see in the dark

Generated browser-free by `tools/qa/lightreach.mjs`. Three questions, three modes.

## 1. The plan — distance to the nearest live fitting

```
light reach — horizontal distance from a walkable point to the nearest live fixture

zone        fixt  live   pts   mean  worst   >5m   worst position
intake       259   192  1764   2.01   7.04    1%   [30.8,0,30.8]
service       74    72   195   1.19   2.79    0%   [378.3,0,-2.1]
cistern       24    24   198   2.22   4.77    0%   [796.3,0.2,10.8]
residence     37    37   113   1.05   2.19    0%   [-20.2,0,397.6]
plant         31    30   434   2.48   5.27    1%   [407.6,-6,398.5]
duct          25    25    29   0.67   1.53    0%   [792.1,0,400]
stack         98    87   108   2.40   4.99    0%   [10.8,0,805.3]
safe           5     5    12   1.05   2.24    0%   [402,0,798.5]

A corridor lit to a 4 m fixture grid should show a worst case near 3 m.
Anything over about 6 m is somewhere the player can stand with no lamp above them.
```

## 2. What the renderer delivers — the 6 lights the shipping tier keeps

```
delivered light — irradiance from the 6 fixtures the rig actually keeps

The other tables in this file count fittings. This one counts what reaches
the shader: LightRig uploads a handful of lights, so a zone can gain thirty
fixtures, improve every reach number, and deliver the same light.

under-lit = below 10.52, the 5th percentile of the Service Spine

zone         live    mean   median     p05    worst   under   kept/all   worst point
intake       192   12.56    12.45    5.34     1.80     34%        51%   [30.8,0,30.8]
service       72   18.13    18.27   10.52     7.41      5%        68%   [421.3,-3.1,9.5]
cistern       24   18.84    17.53    6.41     2.97     16%        85%   [796.3,0.2,10.8]
residence     37   15.92    17.45    8.19     6.54     18%        78%   [5.5,0,404.8]
plant         30   16.14    15.46    8.34     6.31     20%        75%   [383.4,-6,410.8]
duct          25    8.77     8.95    6.46     5.51     93%        80%   [785.8,0,400]
stack         87   33.49    25.01   13.98    12.53      0%        53%   [3,0,789.2]
safe           5   24.11    25.26   10.60    10.60      0%       100%   [402,0,798.5]

kept/all near 100% means the budget is not the constraint there — every
fitting that matters is being driven. Well below it means the zone has more
lamps than the renderer will ever switch on, and adding more changes nothing.
```

## 3. Blackout — can you see anything to walk toward

```
light reach, BLACKOUT — every switchable way tripped; emergency circuit only

zone        fixt  live   pts   mean  worst   >5m   NO SIGHTLINE   worst position
intake       259    13  1764   8.48  26.37   77%           22%   [-26.2,0,-3.2]
service       74     9   195   4.44  11.30   35%           27%   [427.4,0.7,-2.4]
cistern       24     4   198   6.17  15.38   57%           12%   [780.2,0,-2.9]
residence     37     4   113   4.02   7.94   32%           43%   [-23.2,0,397.6]
plant         31     7   434   6.94  15.03   66%            6%   [384.9,-6,390.7]
duct          25    11    29   1.16   2.84    0%            0%   [785.8,0,400]
stack         98     5   108   5.15  10.25   53%            0%   [10.8,0,808.3]
safe           5     1    12   3.26   5.50    8%            8%   [398,0,801.7]

In a blackout the bar is different: somewhere to walk TOWARD, not a lit room.
So NO SIGHTLINE is the column that matters — the share of walkable area from
which no emergency fitting is visible at eye height, walls and machines taken
into account. The >5m column is the lit-room measure and is expected to be
large here; it is kept only so the two can be compared.
A zone with no emergency fixture at all reports "no live fixtures" and is a trap.
Anything over about 6 m is somewhere the player can stand with no lamp above them.
```

## Plan maps, per zone

```
light reach — horizontal distance from a walkable point to the nearest live fixture

zone        fixt  live   pts   mean  worst   >5m   worst position
intake       259   192  1764   2.01   7.04    1%   [30.8,0,30.8]

  intake — plan, 1 m per character, north (−z) at the top
  x -30.7 .. 30.8   z -30.7 .. 30.8
  . <2m   : 2-3   - 3-4   + 4-5   # 5-6   @ >6m   * live fixture   x dead one
  Levels are flattened into one plan and each cell shows its WORST sample,
  so a dark lower deck is not hidden by a lit walkway above it.

  z=  -31 |#+ :. .: .. :. .- +: .. :. . :. .- +:. .: -+ +# -: .. :. .: +#|
  z=  -30 |#x :.*.: *. .* .: x: .* :.*. .* .:x+:. *. :x -+x-: *. .* .: x+|
  z=  -29 |                                                              |
  z=  -28 |#+ -. .: .. :. :. .: .. :. . :. :: ::. .: .. :- -: .. :. :: ::|
  z=  -27 |## +- -: *. :x :. *. .* :.*. :x -. ... *. .* ::x:: .. :. .. ..|
  z=  -26 | x   x                            *                *   *    * |
  z=  -25 |-- -: :: x: -x :. *. .* :. : -- :. ... *. .* :.*.: .. .. .. ..|
  z=  -24 |:: :. .: -- -- :. .. .. :- - :: :: ::. .. .. :. .: :: :: :: ::|
  z=  -23 |     *                                                        |
  z=  -22 |** .. .: .: :. :: .: :. :+ - .* .:x--: .: :. :.*.: *. .* .: x-|
  z=  -21 |.. ..*.: *. .* .. *. .* :- - .. .: +:. *. .* :. .: .. :. .: +#|
  z=  -20 |                                                              |
  z=  -19 |:. :. .: .. :. .. .: .. :. . -: :- +:. .: .. ::x:: .. :: :- +@|
  z=  -18 |.* .. .: :: :. .. .: .. :.*. :+ ++x+-: :: .. :- -: *. :x ++ x@|
  z=  -17 |                                                              |
  z=  -16 |.. :.*.: x- .* .. *. .* :. . :+ +- :-- -: .* .- -: .. :: -- +@|
  z=  -15 |.. :. .: :: :. :: .: .. :: - -+ -. .:: .. .. :- -: .. :. .: +#|
  z=  -14 |                                                              |
  z=  -13 |.* .. .: .. :- -. .: .. :-x+ +x :.*..x .* :x -x x: *. .* .: x+|
  z=  -12 |:. :.*.: *. :x :. *. .* :: : -: :: .:: .. :: -: :: .. :. :: ::|
  z=  -11 |                                                              |
  z=  -10 |.. .. .: .. .. .. .. .. :. . .. .. ..- -: .. :. .: .. :- -. ..|
  z=   -9 |.* ..*.: *. .* .. *. .* :.*. .* ..*..: x: .* :.*.: *. :x :. **|
  z=   -8 |                                                              |
  z=   -7 |:: :: :: .. .. .. .. .. :. . .. .: ::. .. :: :. .: .. .. .: ::|
  z=   -6 |.. .-x-: *. .* .. *. .* :.*. .* .. ... *. -x :.*.: *. .* .. ..|
  z=   -5 | *                                *                         * |
  z=   -4 |.. .-x-: *. .* .. *. .* :.*. .* .. ..: :: -- :.*.: x: :: :. ..|
  z=   -3 |                                                              |
  z=   -2 |:. :- -: .. :. .. .: .. :. . :. .: ::- -+ +- :. .: .. :: .: ::|
  z=   -1 |.* .- +- :: -: -- :- :: :.*. :: --x+++ x+ +x -:x:: *. x. *. :+|
  z=    0 |                                                              |
  z=    1 |.. :: -- :- -: -- :- -: :. . :: -+ +-- :- -: -: :: .. :: .. -+|
  z=    2 |.. .. :: .. :. .. .: .. :: : :. .- +:. .: .. :. .: .. .. .. -+|
  z=    3 | *  *    *   *    *   *   x   *   x    *   *   *   *  *  *    |
  z=    4 |.. .. .: .. .. .. .. .. :- - .. .: +:. .. .. .. .. .. .. .. :+|
  z=    5 |:. .. :: .. :. :: .: .. :: : :. :: :-. .: .. :. .: .. .. .: -+|
  z=    6 |.. .. :: .. :. .. .: -- :. . :. .. ... .: -- -- -. *. :- -- +#|
  z=    7 |                                                              |
  z=    8 |.* .* .: *. .* .. *. :x :.*. x.*..*... *. -x -:x:: .. :- -+ x+|
  z=    9 |:. :. :: .: :. :: .: .. :. : :: .: .:: .: -- :. .: *. :: :: ::|
  z=   10 |                                                              |
  z=   11 |-: .. .. .. :: :: :: .* :. . .. .. ..: :: -- :.*.: :: -. .. ..|
  z=   12 |-: .* *. *. .. .. .. .. :.*. *.*..*... .. -- :. .: x: x. *. *.|
  z=   13 |             *    *   *                *   x   *              |
  z=   14 |:: :: :: :: .. .. .. .. :: : :: .: .:. .. -- :. .: .. :: .: .:|
  z=   15 |.. .. .. .. .. .. .. .. :. . .. .. ... .. -- -: :: *. :: :. ..|
  z=   16 | *  * *  *   *    *   *   *   *   *    *   x                * |
  z=   17 |.. .. .. .. .. .. .. .. :. . .. .. ... .. :: :: :: x: .* .. ..|
  z=   18 |:: :: :: .. .. .. .. .. :: : .. .: .:: :: .. :. .: -- :. .: .:|
  z=   19 |         *   *    *   *   x   *            *   *              |
  z=   20 |.* ..*.: .. .. .. .. .. :- - .. ..*... *. .. :. .: -+ -: :. *.|
  z=   21 |.. .. .: *. .* .. *. .* :-x- .* .. ... .: .* :.*.: x+ +x -. ..|
  z=   22 |                                                              |
  z=   23 |*. :: .: .. :. .. .: .. :- - :. .: .:: .: .. :. .: -- -- -: ::|
  z=   24 |.* ..*.: *. :x :. *. .* :- - .* ..*... *. :x -:x:: .. :. .- -+|
  z=   25 |                                                              |
  z=   26 |.. :. .: .. :- -. .: .. :- - :. .. ... .: -- -- -. *. .* .: +#|
  z=   27 |:. :. .: .. :. :: .: .. :. . :: :: .:. .: .. :. .: .. :. .: +#|
  z=   28 |                                                              |
  z=   29 |.* ..*.: *. .* .. *. .* :.*. :x :.*... *. .* ..*.. *. :x -- x@|
  z=   30 |.. :. .: .. :. .. .: .. :. . :+ -. .:. .: .. :. .: .. :+ +# #@|
           x=-31 → x=31

A corridor lit to a 4 m fixture grid should show a worst case near 3 m.
Anything over about 6 m is somewhere the player can stand with no lamp above them.
light reach — horizontal distance from a walkable point to the nearest live fixture

zone        fixt  live   pts   mean  worst   >5m   worst position
service       74    72   195   1.19   2.79    0%   [378.3,0,-2.1]

  service — plan, 1 m per character, north (−z) at the top
  x 368.8 .. 430.7   z -11.7 .. 9.5
  . <2m   : 2-3   - 3-4   + 4-5   # 5-6   @ >6m   * live fixture   x dead one
  Levels are flattened into one plan and each cell shows its WORST sample,
  so a dark lower deck is not hidden by a lit walkway above it.

  z=  -12 | * *. .* .                                                    |
  z=  -11 | . .. .. .                                                    |
  z=  -10 |          *                                   *               |
  z=   -9 | . .. .. .                              : .: ..               |
  z=   -8 | ..*. .* .                              . .. ..               |
  z=   -7 | *                                        *  *                |
  z=   -6 | . .. .. .                              * .: ..               |
  z=   -5 | . *. .* .   ..                    ..   . .. ..               |
  z=   -4 |             .**                  *.*     *  *            *   |
  z=   -3 | . .. .: :   ..                    ..   . .. ..           . .*|
  z=   -2 |*    *                **      *        *   *   *   *      .*..|
  z=   -1 |.. *. .* ..*.. :x ..*.. *. .* ..*.. .* ..*.. *. .* ..*..      |
  z=    0 |.* ..x.. *. .* .. *. .. *.*.. .. ** .. .. .* .. ..*.* .*  : ..|
  z=    1 |                 . ..       ..                   .. . .      *|
  z=    2 |                   *       * *                  *  *      : .*|
  z=    3 |                 . ..       ..                   .... :       |
  z=    4 |                 . *.                           *             |
  z=    5 |                   *                                          |
  z=    6 |                                                *  *          |
  z=    7 |                                                              |
  z=    8 |                                                              |
  z=    9 |                                                *..*. *       |
           x=369 → x=431

A corridor lit to a 4 m fixture grid should show a worst case near 3 m.
Anything over about 6 m is somewhere the player can stand with no lamp above them.
light reach — horizontal distance from a walkable point to the nearest live fixture

zone        fixt  live   pts   mean  worst   >5m   worst position
cistern       24    24   198   2.22   4.77    0%   [796.3,0.2,10.8]

  cistern — plan, 1 m per character, north (−z) at the top
  x 773.8 .. 819.7   z -6.5 .. 10.8
  . <2m   : 2-3   - 3-4   + 4-5   # 5-6   @ >6m   * live fixture   x dead one
  Levels are flattened into one plan and each cell shows its WORST sample,
  so a dark lower deck is not hidden by a lit walkway above it.

  z=   -6 |   :   . *. *.                      .**. :: .*|
  z=   -5 |                                    . :: -- :.|
  z=   -4 |       : :: ::                      - -: .: ::|
  z=   -3 |:- :.*.: -: ..                                |
  z=   -2 |             *       *       *      + :. *. .*|
  z=   -1 |.: -: :- - :. .: -: .. .- -: .. :- -- -. .. ..|
  z=   -0 |*: -- :. . :. .: .: :. :. .: .: :. :          |
  z=    1 |*: -: :. . :- -. .. -- :. .: -- .. .- -- :- ::|
  z=    2 |        *        *       *        * : :- +- ..|
  z=    3 |.: :.*.            : -:                :- -:.*|
  z=    4 |                   - --             .*.: -- ..|
  z=    5 |                                    . .: .: ::|
  z=    6 |                   . :-             : :. .. --|
  z=    7 |                                         *    |
  z=    8 |                  *. :-                       |
  z=    9 |                   . :-                       |
  z=   10 |                                              |
  z=   11 |                   - -+                       |
           x=774 → x=820

A corridor lit to a 4 m fixture grid should show a worst case near 3 m.
Anything over about 6 m is somewhere the player can stand with no lamp above them.
light reach — horizontal distance from a walkable point to the nearest live fixture

zone        fixt  live   pts   mean  worst   >5m   worst position
residence     37    37   113   1.05   2.19    0%   [-20.2,0,397.6]

  residence — plan, 1 m per character, north (−z) at the top
  x -23.2 .. 17.4   z 395.2 .. 405.9
  . <2m   : 2-3   - 3-4   + 4-5   # 5-6   @ >6m   * live fixture   x dead one
  Levels are flattened into one plan and each cell shows its WORST sample,
  so a dark lower deck is not hidden by a lit walkway above it.

  z=  395 |              . .               . .      |
  z=  396 |              .*.               .*.      |
  z=  397 |*. :          . .               . .      |
  z=  398 |    *                          *         |
  z=  399 |.. *.**.*.* *.** *.*.* ** *.*.*.**.* * *.|
  z=  400 |.. .. .. .. .. .*.. .. .. .. . .. .. . .*|
  z=  401 | *      . .     .. . .    . .      .. . .|
  z=  402 |.. .                               .* .*.|
  z=  403 |        .*.     .* .*.    .*.            |
  z=  404 |        . .     .. . .    . .      .* .*.|
  z=  405 |                                   .. . .|
           x=-23 → x=17

A corridor lit to a 4 m fixture grid should show a worst case near 3 m.
Anything over about 6 m is somewhere the player can stand with no lamp above them.
light reach — horizontal distance from a walkable point to the nearest live fixture

zone        fixt  live   pts   mean  worst   >5m   worst position
plant         31    30   434   2.48   5.27    1%   [407.6,-6,398.5]

  plant — plan, 1 m per character, north (−z) at the top
  x 383.4 .. 416.6   z 389.2 .. 410.8
  . <2m   : 2-3   - 3-4   + 4-5   # 5-6   @ >6m   * live fixture   x dead one
  Levels are flattened into one plan and each cell shows its WORST sample,
  so a dark lower deck is not hidden by a lit walkway above it.

  z=  389 |:.*.:--:.*.::-:.*..--::*:::.* .- +|
  z=  390 |-: :: +- :: -- :: :- -: :- :. :- #|
  z=  391 |                                  |
  z=  392 |.: :: :- -: :: -- -: :: -+ :: :- +|
  z=  393 |*: .. :: .. .. :- :. .. -- :. .: -|
  z=  394 |    * : . ..*   : . *.       *    |
  z=  395 |.: .. :..*.... :: .*..: -- :. .: :|
  z=  396 |.: :: -: .. :: -: .. :- ++ -: :: .|
  z=  397 |*     : . .:    : . .:           *|
  z=  398 |.:--+ +- :: -+ +- :: -+ #+ ++ -: .|
  z=  399 |*.--+ ++ ++ ++ ++ ++ ++ +- -- +- :|
  z=  400 |                             -    |
  z=  401 |.:::: -+ +- :: -+ -: :- -: .: -: .|
  z=  402 |-: .. :- -: .. :+ :. .: -. .. -: *|
  z=  403 |              :            *      |
  z=  404 |.: .*.:- -. *.::+ :.*.. -: .:x-: .|
  z=  405 |*             :                   |
  z=  406 |.: ::::+ -: :: -+ -: :: -- :- -: *|
  z=  407 |*. -- +- :: :---+ -: :- +- :: :: .|
  z=  408 |  :: :- :. .: :: -: .. :- :. .    |
  z=  409 |.: :: -- .. .: :: :. .: -: .* .- :|
  z=  410 |-: *. :- .* ..*.: :.*.: -: .* .- +|
           x=383 → x=417

A corridor lit to a 4 m fixture grid should show a worst case near 3 m.
Anything over about 6 m is somewhere the player can stand with no lamp above them.
light reach — horizontal distance from a walkable point to the nearest live fixture

zone        fixt  live   pts   mean  worst   >5m   worst position
duct          25    25    29   0.67   1.53    0%   [792.1,0,400]

  duct — plan, 1 m per character, north (−z) at the top
  x 785.8 .. 809.6   z 392.4 .. 410.5
  . <2m   : 2-3   - 3-4   + 4-5   # 5-6   @ >6m   * live fixture   x dead one
  Levels are flattened into one plan and each cell shows its WORST sample,
  so a dark lower deck is not hidden by a lit walkway above it.

  z=  392 |                       *|
  z=  393 |                       *|
  z=  394 |                        |
  z=  395 |                  *    *|
  z=  396 |                       .|
  z=  397 |                       *|
  z=  398 |                       .|
  z=  399 |*.*.* .* * *.*.*.*.* *.*|
  z=  400 |            .           |
  z=  401 |            *           |
  z=  402 |            .           |
  z=  403 |     *     *.           |
  z=  404 |                        |
  z=  405 |           *.  *        |
  z=  406 |            *           |
  z=  407 |            *           |
  z=  408 |            .           |
  z=  409 |           *            |
  z=  410 |            .           |
           x=786 → x=810

A corridor lit to a 4 m fixture grid should show a worst case near 3 m.
Anything over about 6 m is somewhere the player can stand with no lamp above them.
light reach — horizontal distance from a walkable point to the nearest live fixture

zone        fixt  live   pts   mean  worst   >5m   worst position
stack         98    87   108   2.40   4.99    0%   [10.8,0,805.3]

  stack — plan, 1 m per character, north (−z) at the top
  x -10.8 .. 10.8   z 789.2 .. 810.8
  . <2m   : 2-3   - 3-4   + 4-5   # 5-6   @ >6m   * live fixture   x dead one
  Levels are flattened into one plan and each cell shows its WORST sample,
  so a dark lower deck is not hidden by a lit walkway above it.

  z=  789 |*. :+ -: ** .- ++ :. *|
  z=  790 |*. :+ -: .* .- ++ :. .|
  z=  791 |..                  ::|
  z=  792 |                      |
  z=  793 |::                  --|
  z=  794 |++                  --|
  z=  795 |                      |
  z=  796 |--                  :.|
  z=  797 |::                  .*|
  z=  798 |                      |
  z=  799 |**                  **|
  z=  800 |..                  ..|
  z=  801 | *                    |
  z=  802 |..                  ::|
  z=  803 |::                  --|
  z=  804 |                      |
  z=  805 |++                  ++|
  z=  806 |--                  --|
  z=  807 |                      |
  z=  808 |::                  ::|
  z=  809 |.. :+ +- .* .: -+ :. .|
  z=  810 |*. :+ +- .**.: -+ :. *|
           x=-11 → x=11

A corridor lit to a 4 m fixture grid should show a worst case near 3 m.
Anything over about 6 m is somewhere the player can stand with no lamp above them.
light reach — horizontal distance from a walkable point to the nearest live fixture

zone        fixt  live   pts   mean  worst   >5m   worst position
safe           5     5    12   1.05   2.24    0%   [402,0,798.5]

  safe — plan, 1 m per character, north (−z) at the top
  x 398.0 .. 402.0   z 798.5 .. 801.7
  . <2m   : 2-3   - 3-4   + 4-5   # 5-6   @ >6m   * live fixture   x dead one
  Levels are flattened into one plan and each cell shows its WORST sample,
  so a dark lower deck is not hidden by a lit walkway above it.

  z=  799 |*.. :|
  z=  800 |..* .|
  z=  801 |*    |
  z=  802 |*..*.|
           x=398 → x=402

A corridor lit to a 4 m fixture grid should show a worst case near 3 m.
Anything over about 6 m is somewhere the player can stand with no lamp above them.
```
