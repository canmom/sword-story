const game = {
  narration : document.getElementById('narration'),
  currentParagraphs : document.getElementById('passages').childNodes,
  paragraphIndex : 0,
  passageIndex : 0,
  passageContainer: document.getElementById('passages'),
  narrationBox: document.getElementById('narration'),
  passages: null,  
};

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
    if (child.nodeType === Node.ELEMENT_NODE) {
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

function loadScript() {
  return new Promise(function(resolve, reject) {
    fetch('twee/script.tw')
      .then(function (response) {
        response.text().then(function(text) {
          game.passages = text.split(/::[A-z '\[\]]+\n/).slice(1);
          resolve();
      });
    });
  });
}

document.getElementById('nextbutton').addEventListener('click', showNextParagraph)


loadScript().then(displayPassage);