const util = require("util");
const { gitHead, createBranch, branchName } = require("./git-commands");
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
  const index = slideDeck.slides.findIndex((slide) => {
    slide.name === branchName;
  });
  console.log(index);
};

/**
 *
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

module.exports = {
  initRepo,
  statusCodes,
  addSlide,
  nextSlide,
  updateSlide,
};
