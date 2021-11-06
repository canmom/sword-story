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
    this.nextInterval = animationSettings.nextInterval;
    this.next = animationSettings.next;
    this.reversed = animationSettings.reversed || false;
    this.holdFinal = animationSettings.holdFinal || false;
    /* init default settings */
    this.nextFrameTimestamp = 0;
    this.currentFrame = this.reversed ? this.nFrames - 1 : 0;
    this.playing = animationSettings.startImmediately !== false;
    this.holding = false;
  }

  advanceFrame() {
    if (!this.reversed) {
      if (this.currentFrame < this.nFrames - 1) {
        this.currentFrame += 1;
      } else {
        this.stopAndScheduleNext();
      }
    } else {
      if (this.currentFrame > 0) {
        this.currentFrame -= 1;
      } else {
        this.stopAndScheduleNext();
      }
    }
  }

  reset() {
    this.currentFrame = this.reversed ? this.nFrames - 1 : 0;
    this.holding = 0;
  }

  stopAndScheduleNext() {
    this.playing = false;
    this.holding = this.holdFinal;
    if (this.next) {
      window.setTimeout(() => {
        this.reset();
        game.animations[this.next].playing = true;
      }, this.nextInterval);
    }
  }

  draw(timestamp,context) {
    if (this.playing) {
      if (timestamp > this.nextFrameTimestamp) {
        this.advanceFrame();
        this.nextFrameTimestamp = timestamp + this.frameInterval;
      }
    }
    if (this.playing || this.holding) {
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
  game.passageContainer.innerHTML = marked.parse(passage);

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
  return Promise.all(Array.from(imageList,(imageName) => loadImage(imageName).then((image) => {game.images[imageName] = image;})));
}

function loadAnimations() {
  return new Promise(function(resolve, reject) {
    fetch('anim/animations.json').then((response) => {
      response.text().then((text) => {
        const framesImageNames = new Set();
        const animationSettingsList = JSON.parse(text);
        /*gather the list of frames images*/
        Object.values(animationSettingsList).forEach((animSettings) => {
          if (typeof animSettings.framesImage === "string") {
            framesImageNames.add(animSettings.framesImage);
          } else {
            throw new TypeError(`Value of framesImage: ${animSettings.framesImage} is not a string.`)
          }
        });
        /* make sure we have those images*/

        loadImages(framesImageNames).then(() => {
          Object.entries(animationSettingsList).forEach(([key,value]) => {
            game.animations[key] = new Animation(value)
          });
          resolve();
        });
      });
    });
  })
}

function loadGame() {
  setUpDoubleBuffering();
  document.getElementById('nextbutton').addEventListener('click', showNextParagraph);
  return Promise.all([
    loadScript(),
    loadImages(['background.png']),
    loadAnimations(),
  ]);
}

function drawFrame(timestamp) {
  game.context.clearRect(0,0,game.context.canvas.width,game.context.canvas.height)
  game.context.drawImage(game.images['background.png'],0,0);
  // game.context.drawImage(game.images['blink.png'],0,0,249,226,100,100,249,226);
  Object.values(game.animations).forEach((animation) => {
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