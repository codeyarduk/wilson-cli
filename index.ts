#!/usr/bin/env ts-node

import jsChunkDir from "./functions/languages/jsChunkDir";
import jsChunkFile from "./functions/languages/jsChunkFile";
import readFile from "./functions/readFiles/readFile";
import readDir from "./functions/readFiles/readDir";
import { argv } from "process";
import startLocalServer from "./functions/startLocalServer";

// requires

import http from "http";
import url from "url";

import fs from "fs";
import path from "path";

import { exec } from "child_process";

class Spinner {
  private frames: string[];
  private interval: NodeJS.Timeout | null;
  private currentFrame: number;
  private message: string;

  constructor() {
    this.frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    this.interval = null;
    this.currentFrame = 0;
    this.message = "";
  }

  public start(message: string = "Loading..."): void {
    this.message = message;
    this.currentFrame = 0;
    this.interval = setInterval(() => {
      process.stdout.write(
        `\r${this.frames[this.currentFrame]} ${this.message}`
      );
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write("\r\x1b[K"); // Clear the line
  }

  public updateMessage(message: string): void {
    this.message = message;
  }
}

function openBrowser(url: string) {
  let command;
  switch (process.platform) {
    case "darwin":
      command = `open "${url}"`;
      break;
    case "win32":
      command = `start "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.error("Failed to open browser:", error);
    }
  });
}

// LOCAL SERVER TO RECEIVE TOKEN



// AUTHENTICATE AT WILSON

async function authenticate() {
  const port = 8000;
  const authUrl = `https://auth.wilson.codeyard.co.uk/api/cli?port=${port}`;
  // const authUrl = `http://localhost:8787/api/cli?port=${port}`;
  // http://localhost:8787
  // auth.codeyard.co.uk/api/cli

  const spinner = new Spinner();
  spinner.start("Waiting for authentication");

  try {
    const serverPromise = startLocalServer(port);
    openBrowser(authUrl);
    const token = await serverPromise;
    spinner.stop();

    if (token) {
      console.log(`Received token: ${token}`);
      return token;
    } else {
      console.log("Authentication failed");
      return null;
    }
  } catch (error) {
    spinner.stop();
    console.error("Authentication error:", error);
    return null;
  }
}

// SAVE THE TOKEN TO THE .wilson-config.json FILE

async function saveToken(token: any) {
  const configPath = path.join(__dirname, ".wilson-config.json");
  const config = token ? { token } : {};
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Token saved to ${configPath}`);
}

// LOAD THE TOKEN FROM THE .wilson-config.json FILE

async function loadToken() {
  const configPath = path.join(__dirname, ".wilson-config.json");
  console.log(configPath);
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config.token;
  }
  return null;
}

// MAIN

(async () => {
  const path = argv[2]; // Get the directory path from the command-line arguments
  if (path) {
    // CHECK IF USER IS LOGGED IN
    let token = await loadToken();
    console.log("this");
    console.log(token);
    if (!token) {
      console.log("User not logged in. Starting authentication process...");
      token = await authenticate();

      if (token) {
        await saveToken(token);
      } else {
        console.error("Failed to obtain token. Exiting.");
        process.exit(1);
      }
    }
    // READ FILES FROM DIRECTORY
    const data = await readDir(path);
    // console.log(path);
    console.log(data);

    const response = await fetch("https://api.wilson.codeyard.co.uk/chunk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: JSON.stringify(data), token: token }),
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log(responseData);
    } else {
      console.error(
        "Failed to send data to server. Error:",
        response.statusText
      );
    }
  } else {
    console.log("Please provide a directory path.");
  }
})();

export { jsChunkDir, jsChunkFile };
// npm run build
// chmod +x dist/index.js
// npm link
