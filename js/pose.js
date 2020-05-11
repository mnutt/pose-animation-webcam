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

// pose-animator uses flatten() when they should use flat()
if (typeof Array.prototype.flatten === 'undefined') {
  Array.prototype.flatten = Array.prototype.flat;
}

import { drawKeypoints, drawPoint, drawSkeleton } from 'pose-animator/utils/demoUtils';
import { SVGUtils } from 'pose-animator/utils/svgUtils';
import { PoseIllustration } from 'pose-animator/illustrationGen/illustration';
import { Skeleton, facePartName2Index } from 'pose-animator/illustrationGen/skeleton';

import * as girlSVG from 'pose-animator/resources/illustration/girl.svg';
import * as boySVG from 'pose-animator/resources/illustration/boy.svg';
import * as abstractSVG from 'pose-animator/resources/illustration/abstract.svg';
import * as blathersSVG from 'pose-animator/resources/illustration/blathers.svg';
import * as tomNookSVG from 'pose-animator/resources/illustration/tom-nook.svg';
import * as glassesSVG from '../resources/body.svg';

import background from '../resources/background.jpg';

// Camera stream video element
let video;
let videoWidth = 300;
let videoHeight = 300;

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
let minPoseConfidence = 0.15;
let minPartConfidence = 0.1;
let nmsRadius = 30.0;

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

function drawBackground() {
  const originalOperation = outputContext.globalCompositeOperation;
  outputContext.globalCompositeOperation = 'destination-over';
  outputContext.drawImage(background, 0, 0, canvasWidth, canvasHeight);
  outputContext.globalCompositeOperation = originalOperation;
}

/**
 * Feeds an image to posenet to estimate poses - this is where the magic
 * happens. This function loops with a requestAnimationFrame method.
 */
function detectPoseInRealTime(video) {
  const canvas = document.createElement('canvas');
  const videoCtx = canvas.getContext('2d');

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  async function poseDetectionFrame() {
    drawBackground();

    videoCtx.clearRect(0, 0, videoWidth, videoHeight);
    // Draw video, horizontally flipped
    videoCtx.save();
    videoCtx.scale(-1, 1);
    videoCtx.translate(-videoWidth, 0);
    videoCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
    videoCtx.restore();

    // Creates a tensor from an image
    const input = tf.browser.fromPixels(canvas);
    faceDetection = await facemesh.estimateFaces(input, false, false);

    const poses = await posenet.estimateMultiplePoses(video, {
      flipHorizontal: true,
      maxDetections: 1,
      scoreThreshold: minPartConfidence,
      nmsRadius: nmsRadius,
    });

    input.dispose();

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
      new canvasScope.Point(-150, 0)
    );

    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}

function setupCanvas() {
  canvasScope = paper.default;
  let canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  outputCanvas = canvas;
  outputContext = canvas.getContext('2d');
  canvasScope.setup(canvas);

  const bg = new canvasScope.Raster({
    source: background,
    position: canvasScope.view.center,
  });
}

async function parseSVG(target) {
  let svgScope = await SVGUtils.importSVG(target /* SVG string or file path */);
  let skeleton = new Skeleton(svgScope);
  illustration = new PoseIllustration(canvasScope);
  illustration.bindSkeleton(skeleton, svgScope);
}

export async function transform(video) {
  setupCanvas();

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
