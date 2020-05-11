/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as posenet_module from '@tensorflow-models/posenet';
import * as facemesh_module from '@tensorflow-models/facemesh';
import * as tf from '@tensorflow/tfjs';
import * as paper from 'paper';
import Stats from 'stats.js';

// pose-animator uses flatten() when they should use flat()
if (typeof Array.prototype.flatten === 'undefined') {
  Array.prototype.flatten = Array.prototype.flat;
}

import { SVGUtils } from 'pose-animator/utils/svgUtils';
import { PoseIllustration } from 'pose-animator/illustrationGen/illustration';
import { Skeleton } from 'pose-animator/illustrationGen/skeleton';

import * as girlSVG from 'pose-animator/resources/illustration/girl.svg';
import * as boySVG from 'pose-animator/resources/illustration/boy.svg';
import * as abstractSVG from 'pose-animator/resources/illustration/abstract.svg';
import * as blathersSVG from 'pose-animator/resources/illustration/blathers.svg';
import * as tomNookSVG from 'pose-animator/resources/illustration/tom-nook.svg';
import * as glassesSVG from '../resources/body.svg';

import background from '../resources/background.jpg';

// Camera stream video element
let videoWidth = 300;
let videoHeight = 300;
let videoCanvas, videoCtx;

// Canvas
let faceDetection = null;
let illustration = null;
let outputCanvas, outputContext;
let canvasScope;
let canvasWidth = 1280;
let canvasHeight = 760;

// ML models
let facemesh;
let posenet;
let minPartConfidence = 0.1;
let nmsRadius = 30.0;

let isDebugging = true;
const stats = new Stats();

// Misc
const avatarSvgs = {
  girl: girlSVG.default,
  glasses: glassesSVG.default,
  boy: boySVG.default,
  abstract: abstractSVG.default,
  blathers: blathersSVG.default,
  'tom-nook': tomNookSVG.default,
};

const defaultPoseNetArchitecture = 'MobileNetV1';
const defaultQuantBytes = 2;
const defaultMultiplier = 0.75;
const defaultStride = 16;
const defaultInputResolution = 200;

// for debugging
function setupFPS() {
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom);
  console.log('displaying FPS graph');
}

function drawBackground() {
  const originalOperation = outputContext.globalCompositeOperation;
  // draw background behind the body
  outputContext.globalCompositeOperation = 'destination-over';
  outputContext.drawImage(background, 0, 0, canvasWidth, canvasHeight);
  outputContext.globalCompositeOperation = originalOperation;
}

/**
 * Feeds an image to posenet to estimate poses - this is where the magic
 * happens. This function loops with a requestAnimationFrame method.
 */
function detectPoseInRealTime(video) {
  async function poseDetectionFrame() {
    stats.begin();

    drawBackground();

    videoCtx.clearRect(0, 0, videoWidth, videoHeight);
    // Draw video, horizontally flipped
    videoCtx.save();
    videoCtx.scale(-1, 1);
    videoCtx.translate(-videoWidth, 0);
    videoCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
    videoCtx.restore();

    // Creates a tensor from an image
    const inputFrame = tf.browser.fromPixels(videoCanvas);
    faceDetection = await facemesh.estimateFaces(inputFrame, false, false);

    const poses = await posenet.estimateMultiplePoses(video, {
      flipHorizontal: true,
      maxDetections: 1,
      scoreThreshold: minPartConfidence,
      nmsRadius: nmsRadius,
    });

    inputFrame.dispose();

    canvasScope.project.clear();

    if (poses.length >= 1 && illustration) {
      let pose = poses[0];

      Skeleton.flipPose(pose);

      if (faceDetection && faceDetection.length > 0) {
        let face = Skeleton.toFaceFrame(faceDetection[0]);
        illustration.updateSkeleton(pose, face);
      } else {
        illustration.updateSkeleton(pose, null);
      }
      illustration.draw(canvasScope, videoWidth, videoHeight);
    }

    canvasScope.project.activeLayer.scale(
      canvasHeight / videoWidth,
      canvasHeight / videoHeight,
      new canvasScope.Point(-150, 0) // centered-ish
    );

    // End monitoring code for frames per second
    stats.end();

    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}

function setupOutputCanvas() {
  canvasScope = paper.default;

  outputCanvas = document.createElement('canvas');
  outputCanvas.width = canvasWidth;
  outputCanvas.height = canvasHeight;
  outputContext = outputCanvas.getContext('2d');
  canvasScope.setup(outputCanvas);
}

function setupVideoCanvas() {
  videoCanvas = document.createElement('canvas');
  videoCanvas.width = videoWidth;
  videoCanvas.height = videoHeight;
  videoCtx = videoCanvas.getContext('2d');
}

async function parseSVG(target) {
  let svgScope = await SVGUtils.importSVG(target /* SVG string or file path */);
  let skeleton = new Skeleton(svgScope);
  illustration = new PoseIllustration(canvasScope);
  illustration.bindSkeleton(skeleton, svgScope);
}

export async function transform(video) {
  setupOutputCanvas();
  setupVideoCanvas();

  if (isDebugging) {
    setupFPS();
  }

  video.width = videoWidth;
  video.height = videoHeight;
  video.play();

  posenet = await posenet_module.load({
    architecture: defaultPoseNetArchitecture,
    outputStride: defaultStride,
    inputResolution: defaultInputResolution,
    multiplier: defaultMultiplier,
    quantBytes: defaultQuantBytes,
  });

  facemesh = await facemesh_module.load();
  await parseSVG(Object.values(avatarSvgs)[1]);

  detectPoseInRealTime(video, posenet);

  return outputCanvas.captureStream();
}
