const util = require("util");
const { gitHead, createBranch } = require("./git-commands");
const readFile = util.promisify(require("fs").readFile);
const writeFile = util.promisify(require("fs").writeFile);
const stat = util.promisify(require("fs").stat);

const statusCodes = {
  SUCCESS: 0,
  UNKNOWN_ERROR: 1,
  REPO_ALREADY_INITIALIZED: 2,
  NOT_A_GIT_REPO: 3,
};

const newFile = () => ({
  version: "1.0.0",
  slides: [],
});

const DEFAULT_DECK_PATH = ".slide-deck.json";

const initRepo = async () => {
  try {
    await gitHead();
  } catch (e) {
    return statusCodes.NOT_A_GIT_REPO;
  }
  try {
    const status = await stat(DEFAULT_DECK_PATH);
    if (status.isFile()) {
      return statusCodes.REPO_ALREADY_INITIALIZED;
    }
  } catch (e) {
    writeDeck(newFile());
    return statusCodes.SUCCESS;
  }
};

const writeDeck = async (deck) =>
  writeFile(DEFAULT_DECK_PATH, JSON.stringify(deck));

const parseDeck = async () => {
  const contents = await readFile(DEFAULT_DECK_PATH);
  return JSON.parse(contents);
};

const openSlide = (slide) => createBranch(`slide-${slide.name}`, slide.commit);

const addSlide = async (name, commit) => {
  try {
    const slideDeck = await parseDeck();
    slideDeck.slides.push({ name, commit });
    await writeDeck(slideDeck);
    await openSlide({ name, commit });
    return statusCodes.SUCCESS;
  } catch (e) {
    return statusCodes.UNKNOWN_ERROR;
  }
};

module.exports = {
  initRepo,
  statusCodes,
  addSlide,
};
