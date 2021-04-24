import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getSatisfyingVersion } from "./lib/get-version";

const fetch = require("node-fetch");
const makeDir = require('make-dir');

async function run() {
    try {
        const platforms = {
            linux: 'linux',
            darwin: 'darwin',
            win32: 'windows',
        };

        const runnerPlatform = os.platform();

        if (!(runnerPlatform in platforms)) {
          throw new Error(
            "Unsupported operating system - Pulumi CLI is only released for Darwin, Linux and Windows"
          );
        }

        const platform = platforms[runnerPlatform];

        const configuredVersion = core.getInput("pulumi-version");

        let version = core.getInput("pulumi-version");
        core.info(`Configured range: ${version}`);

        if (version == "latest") {
            const resp = await fetch("https://www.pulumi.com/latest-version");
            version = await resp.text();
        } else {
            const resp = await getSatisfyingVersion(version);
            if (resp === null) {
                throw new Error('Could not find a version that satisfied the version range');
            }
            version = resp;
        }

        core.info(`Matched version: ${version}`);

        const downloadUrl = `https://get.pulumi.com/releases/sdk/pulumi-v${version}-${platform}-x64.${platform == "windows" ? "zip" : "tar.gz"}`;
        const destination = path.join(os.homedir(), ".pulumi");
        core.info(`Install destination is ${destination}`)

        const downloaded = await tc.downloadTool(downloadUrl);
        core.info(`successfully downloaded ${downloadUrl}`)


        // The packages for Windows and *nix are structured differently - note the extraction paths for each.
        switch (platform) {
            case "windows":
                await tc.extractZip(downloaded, os.homedir());
                fs.renameSync(path.join(os.homedir(), "Pulumi"), path.join(os.homedir(), ".pulumi"));
                break;
            default:
                let destinationPath = await makeDir(destination);
                core.info(`Successfully created ${destinationPath}`)
                let extractedPath = await tc.extractTar(downloaded, destination);
                core.info(`Successfully extracted ${downloaded} to ${extractedPath}`)
                let oldPath = path.join(destination, "pulumi")
                let newPath = path.join(destination, "bin")
                fs.renameSync(oldPath, newPath);
                core.info(`Successfully renamed ${oldPath} to ${newPath}`)
                break;
        }

        core.addPath(path.join(destination, "bin"));

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
