import { transform } from "./pose.js";

class FilterStream {
  constructor(stream) {
    this.stream = stream;
    const video = document.createElement("video");

    video.srcObject = stream;
    this.video = video;
  }

  async setupStream() {
    console.log("Starting up video stream");
    await this.videoIsReady();
    console.log("Video stream is active");

    return transform(this.video);
  }

  videoIsReady() {
    return new Promise((resolve, reject) => {
      this.video.addEventListener("playing", resolve);
      this.video.addEventListener("error", reject);
      this.video.play();
    });
  }
}

export { FilterStream };
