# Git slide deck

## Installation

```
npm install -g git-slide-deck
```

## Usage from command line

```
Usage: git-slide [options] [command]

Turns your codebase in a slide-deck. Ideal for workshops or partly live coding sessions

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  init            initialize a slide-deck file
  add <name>      adds current commit as new slide
  update          updates current slide to current commit
  next            stashes changes and goes to the next
                  slide
  previous        stashes changes and goes to the previous
                  slide
  first           stashes changes and goes to the first
                  slide
  help [command]  display help for command
```

## Licence

The code is licensed under MIT (see LICENSE file).

## Contributing

Thanks for your interest in contributing! There are many ways to contribute to
this project. [Get started here](CONTRIBUTING.md)
