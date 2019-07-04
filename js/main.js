const imagePrefix = '/img/'

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
  // currentFrame = 0;
  // framesImage;
  // nFrames = 0;
  // pos = {x: 0, y: 0};
  // frameSize = {w: 0, h: 0}
  // frameInterval = 0;
  // loopInterval = 0;
  // loopStyle = "basic";
  // #rewinding = false;
  // nextFrameTimestamp = 0;

  constructor(frames, nFrames, pos, frameSize, frameInterval, loopInterval, loopStyle) {
    this.framesImage = frames;
    this.nFrames = nFrames;
    this.pos = pos;
    this.frameSize = frameSize;
    this.frameInterval = frameInterval;
    this.loopInterval = loopInterval;
    this.loopStyle = loopStyle ? loopStyle : "basic";
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
          game.passages = text.split(/::[A-z '\[\]]+\n/).slice(1);
          console.log(`Successfully loaded script containing ${game.passages.length} lines!`)
          resolve();
      }, reject);
    });
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    let img = new Image();
    img.addEventListener('load', e => resolve(img));
    img.addEventListener('error', () => {
      reject(new Error(`Failed to load image's URL: ${url}`));
    });
    img.src = url;
  });
}

function loadImages(imageList) {
  return new Promise((resolve, reject) => {
    const numImagesToLoad = imageList.length;
    imageList.forEach((imageName) => {
      const imageUrl = imagePrefix + imageName;
      loadImage(imageUrl).then(
        (image) => {/*on resolve*/ 
          game.images[imageName] = image
          if (Object.keys(game.images).length === numImagesToLoad) {
            console.log(`Successfully loaded ${numImagesToLoad} images!`)
            resolve()
          }
        },
        (error) => {/*on reject*/
          reject(error)
        }
      );
    });
  });
}

function testAnimation() {
  game.animations.push(new Animation(
    game.images['blink.png'],
    5,
    {x: 120, y: 190},
    {w: 249, h: 226},
    100,
    2500,
    "rewind"))
}

function loadGame() {
  return new Promise((resolve, reject) => {
    setUpDoubleBuffering();
    document.getElementById('nextbutton').addEventListener('click', showNextParagraph);
    const loadingState = {
      images: false,
      script: false,
    };

    function resolveIfReady() {
      if (loadingState.images && loadingState.script) {
        resolve()
      }
    }

    loadScript().then(() => {
      loadingState.script = true;
      resolveIfReady();
    });

    loadImages(['background.png','blink.png']).then(() => {
      loadingState.images = true;
      resolveIfReady();
    })
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
  testAnimation();
  window.requestAnimationFrame(drawFrame);
  displayPassage();
}

loadGame().then(beginGame);