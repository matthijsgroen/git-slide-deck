const util = require("util");
const {
  createBranch,
  branchName,
  switchBranch,
  stash,
  titleOfCommit,
  isGitRepo,
} = require("./git-commands");
const readFile = util.promisify(require("fs").readFile);
const writeFile = util.promisify(require("fs").writeFile);
const stat = util.promisify(require("fs").stat);

/**
 * @typedef {{ name: string; commit: string; }} Slide
 * @typedef {{ version: string; slides: Slide[]; }} Deck
 * @typedef {{ key: string; execute: () => Promise<void>; enabled: boolean; actionLine: string; }} Action
 */

const statusCodes = {
  UNKNOWN_ERROR: 1,
  REPO_ALREADY_INITIALIZED: 2,
  NOT_A_GIT_REPO: 3,
  NOT_A_SLIDE: 4,
  CANT_READ_SLIDE_DECK: 5,
  CANT_WRITE_SLIDE_DECK: 6,
  END_OF_PRESENTATION: 7,
};

/**
 * @returns {Deck}
 */
const newFile = () => ({
  version: "1.0.0",
  slides: [],
});

const DEFAULT_DECK_PATH = ".slide-deck.json";

/**
 * @param {number} code
 */
const raiseError = (code) => {
  const entry = Object.entries(statusCodes).find(([, v]) => v === code);

  const error = new Error(entry[0]);
  error.errorCode = code;
  throw error;
};

const hasDeckFile = async () => {
  let exists = false;
  try {
    await stat(DEFAULT_DECK_PATH);
    exists = true;
  } catch (e) {}
  return exists;
};

const initRepo = async () => {
  const gitRepo = await isGitRepo();
  if (!gitRepo) {
    raiseError(statusCodes.NOT_A_GIT_REPO);
  }
  const exists = await hasDeckFile();
  if (exists) {
    raiseError(statusCodes.REPO_ALREADY_INITIALIZED);
  }

  writeDeck(newFile());
};

/**
 *
 * @param {Deck} deck
 * @returns
 */
const writeDeck = async (deck) => {
  try {
    await writeFile(DEFAULT_DECK_PATH, JSON.stringify(deck, undefined, 2));
  } catch (e) {
    raiseError(statusCodes.CANT_WRITE_SLIDE_DECK);
  }
};

/**
 * @returns {Promise<Deck>}
 */
const parseDeck = async () => {
  try {
    const contents = await readFile(DEFAULT_DECK_PATH);
    return JSON.parse(contents);
  } catch (e) {
    raiseError(statusCodes.CANT_READ_SLIDE_DECK);
  }
};

/**
 * @returns {Promise<Deck>}
 */
const createOrParseDeck = async () => {
  const gitRepo = await isGitRepo();
  if (!gitRepo) {
    raiseError(statusCodes.NOT_A_GIT_REPO);
  }
  const exists = await hasDeckFile();
  if (exists) {
    return await parseDeck();
  }
  return newFile();
};

/**
 * @param {Slide} slide
 */
const openSlide = (slide) => createBranch(`slide-${slide.name}`, slide.commit);

/**
 * @param {string} name
 * @param {string} commit
 */
const addSlide = async (name, commit) => {
  const slideDeck = await parseDeck();
  slideDeck.slides.push({ name, commit });
  await writeDeck(slideDeck);
  try {
    await openSlide({ name, commit });
    return statusCodes.SUCCESS;
  } catch (e) {
    raiseError(statusCodes.UNKNOWN_ERROR);
  }
};

const nextSlide = async () => {
  const [slideDeck, currentBranch] = await Promise.all([
    parseDeck(),
    branchName(),
  ]);
  if (!currentBranch.startsWith("slide-")) {
    raiseError(statusCodes.NOT_A_SLIDE);
  }
  const slideName = currentBranch.slice("slide-".length);
  const index = slideDeck.slides.findIndex((slide) => slide.name === slideName);
  const nextSlide = slideDeck.slides[index + 1];
  if (!nextSlide) {
    raiseError(statusCodes.END_OF_PRESENTATION);
  }
  await openSlide(nextSlide);
};

const previousSlide = async () => {
  const [slideDeck, currentBranch] = await Promise.all([
    parseDeck(),
    branchName(),
  ]);
  if (!currentBranch.startsWith("slide-")) {
    raiseError(statusCodes.NOT_A_SLIDE);
  }
  const slideName = currentBranch.slice("slide-".length);
  const index = slideDeck.slides.findIndex((slide) => slide.name === slideName);
  const previousSlide = slideDeck.slides[index - 1];
  if (!previousSlide) {
    raiseError(statusCodes.END_OF_PRESENTATION);
  }
  await openSlide(previousSlide);
};

const firstSlide = async () => {
  const slideDeck = await parseDeck();
  const firstSlide = slideDeck.slides[0];
  if (!firstSlide) {
    raiseError(statusCodes.END_OF_PRESENTATION);
  }
  await openSlide(firstSlide);
};

/**
 * @param {string} commit
 */
const updateSlide = async (commit) => {
  const [slideDeck, currentBranch] = await Promise.all([
    parseDeck(),
    branchName(),
  ]);
  if (!currentBranch.startsWith("slide-")) {
    raiseError(statusCodes.NOT_A_SLIDE);
  }
  const slideName = currentBranch.slice("slide-".length);
  const index = slideDeck.slides.findIndex((slide) => slide.name === slideName);
  if (index === -1) {
    raiseError(statusCodes.NOT_A_SLIDE);
  }
  slideDeck.slides[index].commit = commit;
  await writeDeck(slideDeck);
};

const stdin = process.stdin;

const cls = () => process.stdout.write("\x1Bc");

/**
 * @param {string} prompt
 * @returns {Promise<string>}
 */
const getInput = async (prompt) =>
  new Promise((resolve) => {
    process.stdout.write(prompt);
    stdin.setRawMode(false);
    stdin.setEncoding("utf8");
    const callback = function (chunk) {
      resolve(chunk.slice(0, -1));

      stdin.setRawMode(true);
      stdin.setEncoding("utf8");
      stdin.removeListener("data", callback);
    };

    stdin.on("data", callback);
  });

const client = async (presentMode = true) => {
  const [slideDeck, startBranch] = await Promise.all([
    presentMode ? parseDeck() : createOrParseDeck(),
    branchName(),
  ]);
  let index = 0;
  let running = true;

  stdin.resume();
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");

  /** @type {null | (key: string) => void} */
  let waitKey = null;

  stdin.on("data", function (key) {
    // ctrl-c ( end of text )
    if (key === "\u0003" || key === "\u001b") {
      process.exit();
    }
    if (waitKey) {
      waitKey(key);
      waitKey = null;
    }
  });

  /**
   *
   * @param {string[]} keys
   * @returns {Promise<string>}
   */
  const validInputKey = async (keys) =>
    new Promise((resolve) => {
      const keyHandler = (key) => {
        if (keys.includes(key)) {
          resolve(key);
        }
        waitKey = keyHandler;
      };

      waitKey = keyHandler;
    });

  let message = "";

  do {
    const slide = slideDeck.slides[index];
    if (slide) {
      if (presentMode) {
        await stash();
      }
      await openSlide(slide);
    }

    cls();
    if (message.length > 0) {
      console.log(message);
      console.log("");
    }
    message = "";

    if (slide) {
      console.log(`on: ${slide.name} ${index + 1}/${slideDeck.slides.length}`);
    } else {
      console.log(`no slides yet.`);
    }
    console.log("");

    /** @type {Action[]} */
    const actions = [
      {
        key: "p",
        actionLine: `previous: ${slideDeck.slides[index - 1].name}`,
        execute: () => {
          index--;
        },
        enabled: index > 0,
      },
      {
        key: "n",
        actionLine: `next: ${slideDeck.slides[index + 1].name}`,
        execute: () => {
          index++;
        },
        enabled: index < slideDeck.slides.length - 1,
      },
      {
        key: "u",
        actionLine: "update current slide",
        execute: async () => {
          const commit = await currentCommit();
          const title = await titleOfCommit(commit);
          if (slideDeck.slides[index].commit !== commit) {
            slideDeck.slides[index].commit = commit;
            message = `Slide updated. -- '${title}'`;
          } else {
            message = `Slide is already this commit. -- '${title}'`;
          }
        },
        enabled: !presentMode && slide,
      },
      {
        key: "a",
        actionLine: "add slide after this one",
        execute: async () => {
          const commit = await currentCommit();
          const title = await titleOfCommit(commit);
          const slideName = await getInput(
            "New slide name (empty to cancel): "
          );
          if (slideName === "") {
            message = `Slide adding canceled.`;
          } else {
            const newIndex = slide ? index + 1 : index;
            slideDeck.slides.splice(newIndex, 0, { name: slideName, commit });
            index = newIndex;
            message = `Slide added. -- '${title}'`;
          }
        },
        enabled: !presentMode,
      },
      {
        key: "s",
        actionLine: "save & quit",
        execute: async () => {
          await stash();
          await switchBranch(startBranch);
          await writeDeck(slideDeck);
          console.log("Slide deck saved.");
          running = false;
        },
        enabled: !presentMode,
      },
      {
        key: "q",
        actionLine: "quit",
        execute: async () => {
          running = false;
        },
        enabled: true,
      },
    ];
    /** @type {string[]} */
    const enabledKeys = [];
    for (const action of actions) {
      if (action.enabled) {
        console.log(`${action.key}) ${action.actionLine}`);
        enabledKeys.push(action.key);
      }
    }
    const key = await validInputKey(enabledKeys);
    const action = actions.find((a) => a.key === key);
    if (action && action.enabled) {
      await action.execute();
    }
  } while (running);
  await stash();
  await switchBranch(startBranch);
  stdin.pause();
};

module.exports = {
  initRepo,
  statusCodes,
  addSlide,
  nextSlide,
  previousSlide,
  updateSlide,
  firstSlide,
  client,
};
