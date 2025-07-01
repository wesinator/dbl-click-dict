/*global browser */

const DEFAULT_LANGUAGE = "en",
  DEFAULT_TRIGGER_KEY = "none",
  IS_HISTORY_ENABLED_BY_DEFAULT = true,
  IS_CONFIRM_ENABLED_BY_DEFAULT = false,
  SAVE_STATUS = document.querySelector("#save-status"),
  SAVE_OPTIONS_BUTTON = document.querySelector("#save-btn"),
  RESET_OPTIONS_BUTTON = document.querySelector("#reset-btn"),
  CLEAR_HISTORY_BUTTON = document.querySelector("#clear-history-btn"),
  DOWNLOAD_HISTORY_BUTTON = document.querySelector("#download-history-btn"),
  OS_MAC = "mac",
  KEY_COMMAND = "Command",
  KEY_META = "meta";

async function saveOptions(e) {
  e.preventDefault();
  //
  const WORD_SOURCE = document.querySelector("#word-source").value;
  const LANGUAGE = document.querySelector("#language-selector").value;
  const TRIGGER_KEY = document.querySelector("#popup-dblclick-key").value;

  await browser.storage.local.set({
    word_source: WORD_SOURCE,
    language: LANGUAGE,
    interaction: {
      dblClick: {
        key: TRIGGER_KEY,
      },
    },
    history: {
      enabled: document.querySelector("#store-history-checkbox").checked,
    },
    confirm: {
      enabled: document.querySelector("#store-confirm-checkbox").checked,
    },
  });

  const tabs = await browser.tabs.query({});
  for (const t of tabs) {
    try {
      await browser.tabs.sendMessage(t.id, {
        cmd: "updateSettings",
        WORD_SOURCE: document.querySelector('#word-source').value,
        TRIGGER_KEY: document.querySelector("#popup-dblclick-key").value,
        LANGUAGE: document.querySelector("#language-selector").value,
        CONFIRM: document.querySelector("#store-confirm-checkbox").checked,
      });
    } catch (e) {
      console.error(e);
      // noop
    }
  }

  showSaveStatusAnimation();
}

async function restoreOptions() {
  let results = await browser.storage.local.get();

  results = results || {};

  results = results || {};

  let language = results.language || DEFAULT_LANGUAGE,
    interaction = results.interaction || {},
    history = results.history || { enabled: IS_HISTORY_ENABLED_BY_DEFAULT },
    definitions = results.definitions || {},
    confirm = results.confirm || { enabled: IS_CONFIRM_ENABLED_BY_DEFAULT };
  
  // word source
  document.querySelector('#word-source').value = results.word_source || "ecosia";

  // language
  document.querySelector("#language-selector").value =
    language || DEFAULT_LANGUAGE;

  // interaction
  document.querySelector("#popup-dblclick-key").value =
    (interaction.dblClick && interaction.dblClick.key) || DEFAULT_TRIGGER_KEY;

  // history
  document.querySelector("#store-history-checkbox").checked = history.enabled;

  // confirm
  document.querySelector("#store-confirm-checkbox").checked = confirm.enabled;

  let ret = 0;
  for (const lang in definitions) {
    if (Object.hasOwn(definitions, lang)) {
      ret = ret + Object.keys(definitions[lang]["definitions"]).length;
    }
  }
  document.querySelector("#num-words-in-history").innerText = ret;
}

async function downloadHistory(e) {
  let results = await browser.storage.local.get("definitions");
  let definitions = results.definitions || {};

  var wordsJson = JSON.stringify(definitions, null, 2);
  //console.log(definitions, wordsJson);
  var utcDate = new Date().toJSON().slice(0,10);
  var a = document.createElement("a");

  // need encodeURIComponent to include json newlines properly
  a.href = "data:text/json;charset=utf-8," + encodeURIComponent(wordsJson);
  a.download = "Double-Click-Dictionary-Definitions_" + utcDate + ".json";
  a.click();

  e.preventDefault();
}

async function resetOptions(e) {
  await browser.storage.local.set({
    word_source: "ecosia",
    language: DEFAULT_LANGUAGE,
    interaction: {
      dblClick: {
        key: DEFAULT_TRIGGER_KEY,
      },
    },
    history: {
      enabled: IS_HISTORY_ENABLED_BY_DEFAULT,
    },
    confirm: {
      enabled: IS_CONFIRM_ENABLED_BY_DEFAULT,
    },
  });

  restoreOptions();

  e.preventDefault();
}

function clearHistory(e) {
  e.preventDefault();
  browser.storage.local.set({ definitions: {} });
}

function showSaveStatusAnimation() {
  SAVE_STATUS.style.setProperty("-webkit-transition", "opacity 0s ease-out");
  SAVE_STATUS.style.opacity = 1;
  window.setTimeout(function () {
    SAVE_STATUS.style.setProperty(
      "-webkit-transition",
      "opacity 0.4s ease-out"
    );
    SAVE_STATUS.style.opacity = 0;
  }, 1500);
}

document.addEventListener("DOMContentLoaded", restoreOptions);

CLEAR_HISTORY_BUTTON.addEventListener("click", clearHistory);
DOWNLOAD_HISTORY_BUTTON.addEventListener("click", downloadHistory);

SAVE_OPTIONS_BUTTON.addEventListener("click", saveOptions);
RESET_OPTIONS_BUTTON.addEventListener("click", resetOptions);

if (window.navigator.platform.toLowerCase().includes(OS_MAC)) {
  document.getElementById("popup-dblclick-key-ctrl").textContent = KEY_COMMAND;
  document.getElementById("popup-dblclick-key-ctrl").value = KEY_META;
}
