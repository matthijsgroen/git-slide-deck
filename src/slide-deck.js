const util = require("util");
const { gitHead, createBranch } = require("./git-commands");
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
  const status = await stat(DEFAULT_DECK_PATH);
  if (status.isFile()) {
    raiseError(statusCodes.REPO_ALREADY_INITIALIZED);
  }
  writeDeck(newFile());
};

/**
 *
 * @param {Deck} deck
 * @returns
 */
const writeDeck = async (deck) =>
  writeFile(DEFAULT_DECK_PATH, JSON.stringify(deck, undefined, 2));

/**
 * @returns {Deck}
 */
const parseDeck = async () => {
  const contents = await readFile(DEFAULT_DECK_PATH);
  return JSON.parse(contents);
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
  try {
    const slideDeck = await parseDeck();
    slideDeck.slides.push({ name, commit });
    await writeDeck(slideDeck);
    await openSlide({ name, commit });
    return statusCodes.SUCCESS;
  } catch (e) {
    raiseError(statusCodes.UNKNOWN_ERROR);
  }
};

module.exports = {
  initRepo,
  statusCodes,
  addSlide,
};
