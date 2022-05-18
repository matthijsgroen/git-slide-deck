const program = require("commander");

const { version } = require("../package.json");
const {
  initRepo,
  statusCodes,
  addSlide,
  nextSlide,
  updateSlide,
  previousSlide,
  firstSlide,
  present,
} = require("./slide-deck");
const { currentCommit } = require("./git-commands");

program
  .version(version)
  .description(
    "Turns your codebase in a slide-deck. Ideal for workshops or partly live coding sessions"
  );

const handleError = (error) => {
  if (error.errorCode === statusCodes.REPO_ALREADY_INITIALIZED) {
    console.log("Error: Repos already has a slide-deck file.");
    process.exit(1);
  }
  console.log("Error: ", error.message);
  process.exit(1);
};

program
  .command("init")
  .description("initialize a slide-deck file")
  .action(async function () {
    try {
      await initRepo();
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("add <name>")
  .description("adds current commit as new slide")
  .action(async function (name) {
    try {
      const commit = await currentCommit();
      await addSlide(name, commit);
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("update")
  .description("updates current slide to current commit")
  .action(async function () {
    try {
      const commit = await currentCommit();
      await updateSlide(commit);
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("next")
  .description("stashes changes and goes to the next slide")
  .action(async function () {
    try {
      await nextSlide();
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("previous")
  .description("stashes changes and goes to the previous slide")
  .action(async function () {
    try {
      await previousSlide();
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("first")
  .description("stashes changes and goes to the first slide")
  .action(async function () {
    try {
      await firstSlide();
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("present")
  .description("plays entire deck as client, starting from the first slide")
  .action(async function () {
    try {
      await present();
    } catch (e) {
      handleError(e);
    }
  });

async function run(args) {
  program.parse(args);
  if (program.args.length === 0) {
    program.outputHelp();
    return;
  }
}
module.exports = {
  run,
};
