// Prints where the product, the pill and the type land on screen at chosen times, so each shot
// is framed numerically before anything renders. CUT=home|mobile node frame-check.mjs 0,1.5,3
import { CUT, HEIGHT, WIDTH } from './timeline.mjs';
import {
  PHONE,
  cameraAt,
  defocusAt,
  desk,
  pillAt,
  projectPoint,
  rotate,
  rotation,
} from './motion.mjs';

const times = (process.argv[2] ?? '0,1,2,3,4,5').split(',').map(Number);

const fmt = (p) => `(${p[0].toFixed(0)}, ${p[1].toFixed(0)})`;

const onPhone = (x, y, d = 0) => {
  const m = rotation([0, PHONE.yaw, 0]);
  const o = rotate(m, [x, y, d]);

  return [PHONE.center[0] + o[0], PHONE.center[1] + o[1], PHONE.center[2] + o[2]];
};

for (const t of times) {
  const camera = cameraAt(t);
  const pill = pillAt(t);
  const box = [];

  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      box.push(projectPoint(camera, [pill.x + sx * pill.hw, pill.y + sy * pill.hh, pill.z]));
  const xs = box.map((p) => p[0]);
  const ys = box.map((p) => p[1]);
  console.log(
    `${CUT} t=${t}: pill centre ${fmt(projectPoint(camera, [pill.x, pill.y, pill.z]))} box x ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)} y ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)}  focus ${camera.focus.toFixed(0)} defocus ${defocusAt(t).toFixed(1)} px`,
  );

  if (CUT === 'home') {
    const icons = [303, 367, 431, 495, 559, 623, 687, 751, 815, 896].map((x) =>
      projectPoint(camera, desk(x, 700)),
    );

    console.log('   icons', icons.map(fmt).join(' '));
    console.log(
      '   dock top-left',
      fmt(projectPoint(camera, desk(263.5, 662))),
      'dock bottom-right',
      fmt(projectPoint(camera, desk(936.5, 738))),
    );
    console.log(
      '   player widget',
      fmt(projectPoint(camera, desk(28, 56))),
      fmt(projectPoint(camera, desk(348, 242))),
      ' desk bottom-left',
      fmt(projectPoint(camera, desk(0, 750))),
    );
  } else {
    console.log(
      '   phone corners',
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]
        .map(([a, b]) => fmt(projectPoint(camera, onPhone(a * PHONE.half[0], b * PHONE.half[1]))))
        .join(' '),
    );
    console.log(
      '   segments',
      [-127, 0, 126].map((x) => fmt(projectPoint(camera, onPhone(x, -275)))).join(' '),
      ' desk TL',
      fmt(projectPoint(camera, desk(0, 0))),
      'desk BR',
      fmt(projectPoint(camera, desk(1200, 750))),
    );
  }
}

console.log(`frame ${WIDTH}x${HEIGHT}; type block x 61..~560, y 40..300`);
