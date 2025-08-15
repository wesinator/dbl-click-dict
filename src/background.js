/* global browser */

var manifest = browser.runtime.getManifest();
const FXVER = /rv:([0-9.]+)/.exec(navigator.userAgent)[1];
const USRAG = `Mozilla/5.0 (Firefox; rv:${FXVER}) Gecko/20100101 WebExtension/${manifest.browser_specific_settings.gecko.id} ${manifest.version}`;

const GOOGLE_SPEECH_URI = "https://www.google.com/speech-api/v1/synthesize",
  DEFAULT_HISTORY_SETTING = {
    enabled: true,
  },
  DEFAULT_WORD_SOURCE = "ecosia";

function readTextFile(file, callback) {
    var rawFile = new XMLHttpRequest();
    rawFile.overrideMimeType("application/json");
    rawFile.open("GET", file, true);
    rawFile.onreadystatechange = function() {
        if (rawFile.readyState === 4 && rawFile.status == "200") {
            callback(rawFile.responseText);
        }
    }
    rawFile.send(null);
}

browser.runtime.onMessage.addListener(async (request /*, sender*/) => {
  browser.browserAction.disable();

  const { cmd, word, lang } = request;
  var content = null;

  if (cmd === "cache") {
    let results = await browser.storage.local.get("definitions");

    let definitions = results.definitions || {};
    if (typeof definitions[lang] !== "object") {
      definitions[lang] = {};
    }

    var defnsList = definitions[lang]["definitions"];
    if (defnsList instanceof Array) {
      for (var elem of defnsList) {
        if (elem["word"] == word)
          content = elem;
      }

      browser.browserAction.enable();
    }

    browser.browserAction.enable();
    return content;
  }

  // load word source from json based on word source in settings
  let source_setting = await browser.storage.local.get("word_source");
  let word_source = source_setting.word_source || DEFAULT_WORD_SOURCE;
  readTextFile("./word_sources.json", function(text){
      //console.log("Text:", text)
      var source = JSON.parse(text);
      //console.log(options);
        for (i in source) {
          if (word_source == source[i].name.toLowerCase())
          {
            url = source[i].url;
            method = source[i].method;
            wordDiv = source[i].word_div;
            answerDiv = source[i].word_results_div;
            posDiv = source[i].part_of_speech_div;
            pronunciationDiv = source[i].pronunciation_div;
            definitionDiv = source[i].definition_div;

            //console.log(word_source, url, method, answerDiv, definitionDiv)
          }
        }
  });

  const headers = new Headers({
    "User-Agent": USRAG,
  });

  //console.log("source setting", source_setting.word_source, "word source and url:", word_source, url);

  var lookupUrl = url + word;
  let response = await fetch(lookupUrl, {
    method: method,
    credentials: "omit",
    headers,
  });
  let text = await response.text();
  const document = new DOMParser().parseFromString(text, "text/html")

  content = extractMeaning(document, { word, lang }, lookupUrl);

  results = await browser.storage.local.get();
  if (content && results) {
    let history = results.history || DEFAULT_HISTORY_SETTING;

    if (history.enabled) {
      content.word = word.toLowerCase();
      saveWord(lang, content);
    }
  }
  browser.browserAction.enable();
  return content;
});

function extractMeaning(document, context, lookupUrl) {
  try {
    var word = document.getElementsByClassName(wordDiv)[0].innerText,
      //definitions = document.getElementsByClassName(definitionDiv),
      pos = document.getElementsByClassName(posDiv),
      pronunciation = document.getElementsByClassName(pronunciationDiv)[0].innerText,
      defnStr = pronunciation.trim() + "\n\n";

    // TODO: add nesting with pos section:
    // document.getElementsByClassName("word-definitions__group")[0] .getElementsByClassName("word-definitions__definition")  .getElementsByClassName("word-definitions__pos")[0].innerText 
    answerSections = document.getElementsByClassName(answerDiv);
    for (var i = 0; i < answerSections.length ; i++) {
      defnPartOfSpeech = pos[i].innerText;
      //console.log("pos " + i + ":", defnPartOfSpeech);
      defnStr = defnStr + defnPartOfSpeech + '\n';

      for (var defn of answerSections[i].childNodes) {
        if (defn.className == definitionDiv) {
          defnStr = defnStr + defn.innerText + '\n';
          //console.log("definition:", defn.innerText, '\ndefnStr:', defnStr);
        }
      }
      defnStr = defnStr + '\n';
    }

    defnStr = defnStr[0].toUpperCase() + defnStr.substring(1);
    //console.log("final defnStr:", defnStr);
  }
  catch {
    return null;
  }

  var audio = document.querySelector("audio[jsname='QInZvb']"),
    source = document.querySelector("audio[jsname='QInZvb'] source"),
    audioSrc = source && source.getAttribute("src");

  if (audioSrc) {
    !audioSrc.includes("http") &&
      (audioSrc = audioSrc.replace("//", "https://"));
  } else if (audio) {
    let exactWord = word.replace(/·/g, ""), // We do not want syllable seperator to be present.
      queryString = new URLSearchParams({
        text: exactWord,
        enc: "mpeg",
        lang: context.lang,
        speed: "0.4",
        client: "lr-language-tts",
        use_google_only_voices: 1,
      }).toString();

    audioSrc = `${GOOGLE_SPEECH_URI}?${queryString}`;
  }

  return { word: word, meaning: defnStr, lookupUrl: lookupUrl, audioSrc: audioSrc };
}

async function saveWord(lang, content) {
  let word = content.word;
  let results = await browser.storage.local.get("definitions");

  let definitions = results.definitions;
  if (typeof definitions !== "object") {
    definitions = {};
  }
  if (typeof definitions[lang] !== "object") {
    definitions[lang] = {};
  }
  if (typeof definitions[lang]["definitions"] !== "object") {
    definitions[lang]["definitions"] = [];
  }

  definitions[lang]["definitions"].push(content);

  browser.storage.local.set({
    definitions,
  });
}

browser.menus.create({
  title: "Definition",
  contexts: ["selection"],
  onclick: (info, tab) => {
    browser.tabs.sendMessage(tab.id, { cmd: "showMeaning" });
  },
});
