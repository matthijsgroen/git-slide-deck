const util = require("util");
const {
  gitHead,
  createBranch,
  branchName,
  switchBranch,
  stash,
  titleOfCommit,
} = require("./git-commands");
const readFile = util.promisify(require("fs").readFile);
const writeFile = util.promisify(require("fs").writeFile);
const stat = util.promisify(require("fs").stat);

/**
 * @typedef {{ name: string; commit: string; }} Slide
 * @typedef {{ version: string; slides: Slide[]; }} Deck
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

const initRepo = async () => {
  try {
    await gitHead();
  } catch (e) {
    raiseError(statusCodes.NOT_A_GIT_REPO);
  }
  let exists = false;
  try {
    const status = await stat(DEFAULT_DECK_PATH);
    exists = true;
  } catch (e) {}

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
    parseDeck(),
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

  const PRESENTER_KEYS = ["q", "n", "p"];
  const EDITOR_KEYS = PRESENTER_KEYS.concat(["u", "a", "s"]);

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
    if (!slide) {
      raiseError(statusCodes.END_OF_PRESENTATION);
    }

    if (presentMode) {
      await stash();
    }
    await openSlide(slide);

    const hasNext = index < slideDeck.slides.length - 1;
    const hasPrevious = index > 0;
    cls();
    if (message.length > 0) {
      console.log(message);
      console.log("");
    }
    message = "";
    console.log(`on: ${slide.name}`);
    console.log("");
    if (hasPrevious) {
      console.log(`p) previous: ${slideDeck.slides[index - 1].name}`);
    }
    if (hasNext) {
      console.log(`n) next: ${slideDeck.slides[index + 1].name}`);
    }
    if (!presentMode) {
      console.log("u) update current slide");
      console.log("a) add slide after this one");
      console.log("s) save & quit");
    }
    console.log("q) quit");

    const key = await validInputKey(presentMode ? PRESENTER_KEYS : EDITOR_KEYS);

    console.log("input", key);
    if (key === "p" && hasPrevious) {
      index--;
    }
    if (key === "n" && hasNext) {
      index++;
    }
    if (key === "u") {
      const commit = await currentCommit();
      const title = await titleOfCommit(commit);
      if (slideDeck.slides[index].commit !== commit) {
        slideDeck.slides[index].commit = commit;
        message = `Slide updated. -- '${title}'`;
      } else {
        message = `Slide is already this commit. -- '${title}'`;
      }
    }
    if (key === "a") {
      const commit = await currentCommit();
      const slideName = await getInput("New slide name: ");
      slideDeck.slides.splice(index + 1, 0, { name: slideName, commit });
      index = index + 1;
    }
    if (key === "s") {
      await stash();
      await switchBranch(startBranch);
      await writeDeck(slideDeck);
      console.log("Slide deck saved.");
    }

    if (key === "q") {
      running = false;
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
