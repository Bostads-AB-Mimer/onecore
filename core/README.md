# Introduction

Core orchestration for ONECore.

## Installation

1. Create the file src/config.json (see below)
2. Install nvm
3. Install required version of node: `nvm install`
4. Use required version of node `nvm use`
5. Install packages: `npm run install`

## Development

Start the development server: `npm run dev`

Note: The microservices leasing and property-management must be running for this application to work.

## Env

According to .env.template.

## Documentation of processes in Core

Each process (/processes) is documented through flowcharts and sequence diagrams to clearly demonstrate what the process does and which underlying services are used during the process. To create flowcharts and sequence diagrams, we're using Mermaid for markdown which makes adjustments and collaboration easy. Diagrams in Mermaid can be viewed on GitHub or with the help of a plugin, such as https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid for VSCode.
