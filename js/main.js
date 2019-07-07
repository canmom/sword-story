const imagePrefix = 'img/'

const game = {
  narration : document.getElementById('narration'),
  currentParagraphs : document.getElementById('passages').childNodes,
  context : document.getElementById('canvas').getContext('2d'),
  offscreenBuffer : null,
  paragraphIndex : 0,
  passageIndex : 0,
  passageContainer: document.getElementById('passages'),
  narrationBox: document.getElementById('narration'),
  passages: null,
  images: {},
  animations: [],
};

class Animation {
  constructor(animationSettings) {
    if (animationSettings.framesImage instanceof HTMLImageElement) {
      /* if we're building from an existing Animation */
      this.framesImage = animationSettings.framesImage;
    } else if (typeof animationSettings.framesImage === "string") {
      /* make sure the frames image we want actually exists!*/
      const trialFramesImage = game.images[animationSettings.framesImage];
      if( trialFramesImage instanceof HTMLImageElement) {
        this.framesImage = trialFramesImage;
      } else {
        throw new Error(`Tried to create animation from unknown frames image: ${trialFramesImage}`)
      }
    }
    this.nFrames = animationSettings.nFrames;
    this.pos = animationSettings.pos;
    if (animationSettings.frameSize) {
      this.frameSize = animationSettings.frameSize;
    } else {
      this.frameSize = {w: Math.trunc(this.framesImage.width/this.nFrames), h: this.framesImage.height};
    }
    this.frameInterval = animationSettings.frameInterval;
    this.loopInterval = animationSettings.loopInterval;
    this.loopStyle = animationSettings.loopStyle ? animationSettings.loopStyle : "basic";
    /* init default settings */
    this.rewinding = false;
    this.nextFrameTimestamp = 0;
    this.currentFrame = 0;
    this.playing = true;
  }

  advanceFrame() {
    if (!this.rewinding) {
      if (this.currentFrame < this.nFrames - 1) {
        this.currentFrame += 1;
      } else if (this.loopStyle = "rewind") {
        this.rewinding = true;
        this.advanceFrame();
      } else {
        this.currentFrame = 0;
        this.stopAndScheduleNextPlayback();
      }
    } else {
      if (this.currentFrame > 0) {
        this.currentFrame -= 1;
      } else {
        this.rewinding = false;
        this.stopAndScheduleNextPlayback();
      }
    }
  }

  stopAndScheduleNextPlayback() {
    this.playing = false;
    window.setTimeout(() => {this.playing = true}, this.loopInterval);
  }

  draw(timestamp,context) {
    if (this.playing) {
      if (timestamp > this.nextFrameTimestamp) {
        this.advanceFrame();
        this.nextFrameTimestamp = timestamp + this.frameInterval;
      }
      context.drawImage(
        this.framesImage,
        this.currentFrame * this.frameSize.w,
        0,
        this.frameSize.w,
        this.frameSize.h,
        this.pos.x,
        this.pos.y,
        this.frameSize.w,
        this.frameSize.h);
    }
  }  
}

function smarten(text) {
  return text
    /* opening singles */
    .replace(/(^|[\s(\["])'/g, "$1‘")

    /* closing singles & apostrophes */
    .replace(/'/g, "’")

    /* opening doubles */
    .replace(/(^|[/\[(\u2018\s])"/g, "$1“")

    /* closing doubles */
    .replace(/"/g, "”")

    /* em-dashes */
    .replace(/--/g, "\u2014");
};

function recursivelySmarten(element) {
  element.childNodes.forEach( (child) => {
    if (child.nodeType !== Node.TEXT_NODE) {
      recursivelySmarten(child)
    } else if (child.nodeType === Node.TEXT_NODE) {
        child.nodeValue = smarten(child.nodeValue);
    }
  });
}

function renderPassage(passage) {
  game.passageContainer.innerHTML = marked(passage);

  game.passageContainer.childNodes.forEach((element, index) => {
    if (element.nodeType === Node.TEXT_NODE) {
      element.remove()
    } else {
      if (index === 0) {
        element.classList.add('revealed');
      }
      recursivelySmarten(element);
    }
  });

  game.paragraphIndex = 0;
}

function hideNarration() {
  game.narrationBox.classList.add('disappearing');
}

function revealNarration() {
  game.narrationBox.classList.remove('disappearing');
}

function displayPassage() {
  renderPassage(game.passages[game.passageIndex]);
  game.passageIndex += 1;
}

function nextPassage() {
  hideNarration();

  //when the fadeout is complete...
  game.narrationBox.addEventListener('transitionend', function (e) {
    game.narrationBox.removeEventListener('transitionend', arguments.callee);
    displayPassage();
    revealNarration();
  });
}

function showNextParagraph() {
  game.paragraphIndex += 1;
  if (game.paragraphIndex < game.currentParagraphs.length) {
    game.currentParagraphs.item(game.paragraphIndex).classList.add('revealed');;
  } else {
    nextPassage();
  }
}

/*async game loader*/
function loadScript() {
  return new Promise(function(resolve, reject) {
    fetch('twee/script.tw')
      .then(function (response) {
        response.text().then(function(text) {
          game.passages = text.split(/::[A-z '\[\]]+\r?\n/).slice(1);
          console.log(`Successfully loaded script containing ${game.passages.length} lines!`)
          resolve();
      }, reject);
    });
  });
}

function loadImage(filename) {
  return new Promise((resolve, reject) => {
    let img = new Image();
    img.addEventListener('load', e => resolve(img));
    img.addEventListener('error', () => {
      reject(new Error(`Failed to load image: ${filename}`));
    });
    img.src = imagePrefix + filename;
  });
}

function loadImages(imageList) {
  return new Promise((resolve, reject) => {
    const nImagesToLoad = imageList.length;
    let nImagesLoaded = 0;
    imageList.forEach((imageName) => {
      const imageUrl = imageName;
      loadImage(imageUrl).then(
        (image) => {/*on resolve*/ 
          game.images[imageName] = image
          nImagesLoaded += 1;
          if (nImagesLoaded === nImagesToLoad) {
            console.log(`Successfully loaded ${nImagesToLoad} images!`)
            resolve()
          }
        }
      );
    });
  });
}

function loadAnimations() {
  return new Promise(function(resolve, reject) {
    fetch('anim/animations.json').then((response) => {
      response.text().then((text) => {
        const framesImageNames = [];
        const animationSettingsList = JSON.parse(text);
        /*gather the list of frames images*/
        animationSettingsList.forEach((animationSettings) => {
          if (typeof animationSettings.framesImage === "string") {
            framesImageNames.push(animationSettings.framesImage);
          } else {
            throw new TypeError(`Value of framesImage: ${animationSettings.framesImage} is not a string.`)
          }
        });
        /* make sure we have those images*/
        loadImages(framesImageNames).then(() => {
          animationSettingsList.forEach((animationSettings) => {
            game.animations.push(new Animation(animationSettings))
          });
          resolve();
        });
      });
    });
  })
}

function loadGame() {
  return new Promise((resolve, reject) => {
    setUpDoubleBuffering();
    document.getElementById('nextbutton').addEventListener('click', showNextParagraph);
    const loadingState = {
      images: false,
      script: false,
      animations: false,
    };

    function resolveIfReady() {
      if (loadingState.images && loadingState.script && loadingState.animations) {
        resolve()
      }
    }

    loadScript().then(() => {
      loadingState.script = true;
      resolveIfReady();
    });

    loadImages(['background.png']).then(() => {
      loadingState.images = true;
      resolveIfReady();
    });

    loadAnimations().then(() => {
      loadingState.animations = true;
      resolveIfReady();
    });
  });
}

function drawFrame(timestamp) {
  game.context.drawImage(game.images['background.png'],0,0);
  // game.context.drawImage(game.images['blink.png'],0,0,249,226,100,100,249,226);
  game.animations.forEach((animation) => {
    animation.draw(timestamp,game.context);
  });
  /*game.context.drawImage(game.offscreenBuffer.canvas,0,0);*/
  window.requestAnimationFrame(drawFrame)
}

function setUpDoubleBuffering() {
  const buffer = document.createElement('canvas');
  buffer.width = game.context.canvas.width;
  buffer.height = game.context.canvas.height;
  game.offscreenBuffer = buffer.getContext('2d');
}

function beginGame() {
  window.requestAnimationFrame(drawFrame);
  displayPassage();
}

loadGame().then(beginGame);