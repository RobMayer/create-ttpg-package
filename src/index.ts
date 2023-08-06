#!/usr/bin/env node

import * as fs from "fs/promises";
import * as chalk from "colorette";
import * as path from "path";
import * as readline from "readline/promises";
import { spawn } from "cross-spawn";
import { v4 as uuid } from "uuid";

const ASSET_DIRS = ["Fonts", "Models", "Sounds", "States", "Templates", "Textures", "Thumbnails"];

const TEMPLATE_ALIASES = {
    javascript: "javascript",
    typescript: "typescript",
    js: "javascript",
    ts: "typescript",
} as const;

const SUPPORTED_TEMPLATES: (keyof typeof TEMPLATE_ALIASES)[] = ["javascript", "typescript", "ts", "js"];

export const Logger = {
    log: (...messages: string[]) => console.log(chalk.white(messages.join(" "))),
    notice: (...messages: string[]) => console.log(chalk.blueBright(messages.join(" "))),
    error: (...messages: string[]) => console.error(chalk.redBright(messages.join(" "))),
    success: (...messages: string[]) => console.error(chalk.greenBright(messages.join(" "))),
    warning: (...messages: string[]) => console.error(chalk.yellowBright(messages.join(" "))),
    welcome: () => console.log(chalk.cyanBright(chalk.underline("Good Morning, Captain!"))),
    complete: () => console.log(chalk.cyanBright(chalk.underline("Good Hunting!"))),
};

const runInstaller = async (cwd: string) => {
    return new Promise((resolve, reject) => {
        const child = spawn("yarn", ["install"], { stdio: "pipe", cwd });
        child.on("error", (e) => reject(e));
        child.on("close", (code: number) => (code > 0 ? reject(code) : resolve(0)));
    });
};

export const pathExists = async (p: string) => {
    const thePath = path.resolve(p);
    try {
        await fs.access(thePath);
        return true;
    } catch {
        return false;
    }
};

const getSuggestedTTPGPath = async (): Promise<string | null> => {
    if (process.platform === "darwin") {
        if (await pathExists(process.env.HOME + "/Library/Application Support/Epic/TabletopPlayground/Package")) {
            return path.resolve(process.env.HOME + "/Library/Application Support/Epic/TabletopPlayground/Package");
        }
    } else if (process.platform === "win32") {
        // steam
        if (await pathExists("C:\\Program Files (x86)\\Steam\\steamapps\\common\\TabletopPlayground\\TabletopPlayground\\PersistentDownloadDir")) {
            return path.resolve("C:\\Program Files (x86)\\Steam\\steamapps\\common\\TabletopPlayground\\TabletopPlayground\\PersistentDownloadDir");
        }
        //epic
        if (await pathExists("C:\\Program Files\\Epic Games\\TabletopPlayground\\TabletopPlayground\\PersistentDownloadDir")) {
            return path.resolve("C:\\Program Files\\Epic Games\\TabletopPlayground\\TabletopPlayground\\PersistentDownloadDir");
        }
        // microsoft store
        if (await pathExists(process.env.HOME + "\\TabletopPlayground\\Packages")) {
            return path.resolve(process.env.HOME + "\\TabletopPlayground\\Packages");
        }
    }
    return null;
};

const guid = () => uuid().replace(/-/g, "").toUpperCase();

const buildProject = async () => {
    const input = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    let projectId = process.argv.slice(2).find((g) => !g.startsWith("-"));
    let idProvided = true;
    const autoConfirm = process.argv.includes("-y");

    if (!projectId) {
        projectId = await input.question(chalk.whiteBright("Enter a name for your package: "));
        idProvided = false;
        if (!projectId) {
            throw Error("project title is required");
        }
    }

    const projectTitle = !idProvided ? projectId : await input.question(chalk.whiteBright("Enter a name for your package: "));

    if (projectTitle) {
        const suggestedSlug = idProvided ? projectId : projectTitle.replace(/\W/g, "-").toLowerCase();
        const inputSlug = autoConfirm || idProvided ? suggestedSlug : (await input.question(chalk.whiteBright(`Enter 'slug' identifier for your package [${chalk.white(suggestedSlug)}]: `))).trim();
        const projectSlug = inputSlug !== "" ? inputSlug : suggestedSlug;

        const template = process.argv.indexOf("--template") > -1 ? process.argv[process.argv.indexOf("--template") + 1] ?? "javascript" : "javascript";

        if (!SUPPORTED_TEMPLATES.includes(template as keyof typeof TEMPLATE_ALIASES)) {
            throw Error("unrecognized template");
        }

        const projectDir = path.resolve(process.cwd(), idProvided ? projectId : projectSlug);
        const templateDir = path.resolve(__dirname, "..", "templates", TEMPLATE_ALIASES[template as keyof typeof TEMPLATE_ALIASES]);

        Logger.log("creating workspace directory");
        try {
            await fs.mkdir(projectDir, { recursive: true });
            Logger.success("Workspace directory created");
        } catch (e) {
            Logger.error("Could not create workspace directory");
            throw e;
        }

        const suggestedPrdGuid = guid();
        const inputPrdGuid = autoConfirm
            ? suggestedPrdGuid
            : (await input.question(chalk.whiteBright(`Provide a production GUID for your package (or 'enter' to use the provided value) [${chalk.white(suggestedPrdGuid)}]: `))).trim();
        const prdGuid = inputPrdGuid !== "" ? inputPrdGuid : suggestedPrdGuid;
        const suggestedDevGuid = guid();
        const inputDevGuid = autoConfirm
            ? suggestedDevGuid
            : (await input.question(chalk.whiteBright(`Provide a development GUID for your package (or 'enter' to use the provided value) [${chalk.white(suggestedDevGuid)}]: `))).trim();
        const devGuid = inputDevGuid !== "" ? inputDevGuid : suggestedDevGuid;
        const suggestedTTPGPath = await getSuggestedTTPGPath();
        const input_ttpg_path = autoConfirm
            ? suggestedTTPGPath
            : (await input.question(chalk.whiteBright(`path to TTPG Package or PersistentDownloadDir directory ${suggestedTTPGPath ? `[${chalk.white(suggestedTTPGPath)}]: ` : ": "}`))).trim();
        const ttpg_path = input_ttpg_path !== "" ? input_ttpg_path : suggestedTTPGPath;
        const suggestedVersion = "0.0.1";
        const inputVersion = autoConfirm ? suggestedVersion : await input.question(chalk.whiteBright("provide a version number [0.0.1]: "));
        const projectVersion = inputVersion !== "" ? inputVersion : suggestedVersion;

        Logger.log("copying template...");
        try {
            await fs.cp(templateDir, projectDir, { recursive: true });
            await fs.rename(path.join(projectDir, "gitignore"), path.join(projectDir, ".gitignore"));
            await fs.rename(path.join(projectDir, "template.package.json"), path.join(projectDir, "package.json"));
            if (template === "typescript") {
                await fs.rename(path.join(projectDir, "template.tsconfig.json"), path.join(projectDir, "tsconfig.json"));
            }
            const projectPackage = JSON.parse(await fs.readFile(path.join(projectDir, "package.json"), "utf-8"));
            projectPackage.name = projectSlug;
            projectPackage.version = projectVersion;
            await fs.writeFile(path.join(projectDir, "package.json"), JSON.stringify(projectPackage, null, 2));
            Logger.success("template copied");
        } catch (e) {
            Logger.error("could not copy template");
            throw e;
        }

        input.close();
        Logger.log("creating asset directories...");
        try {
            await Promise.all(ASSET_DIRS.map((dir) => fs.mkdir(path.join(projectDir, "assets", dir), { recursive: true })));
            Logger.success("asset directories created");
        } catch (e) {
            Logger.error("could not create asset directories");
            throw e;
        }
        Logger.log("creating dev directory...");
        try {
            await fs.mkdir(path.join(projectDir, "dev", `${projectSlug}_dev`), { recursive: true });
            await fs.writeFile(
                path.join(projectDir, "dev", `${projectSlug}_dev`, "Manifest.json"),
                JSON.stringify(
                    {
                        Name: `${projectTitle} (Dev)`,
                        Version: projectVersion,
                        GUID: devGuid,
                    },
                    null,
                    2
                ),
                "utf-8"
            );
            await Promise.all(ASSET_DIRS.map((dir) => fs.symlink(path.join(projectDir, "assets", dir), path.join(projectDir, "dev", `${projectSlug}_dev`, dir), "junction")));
            Logger.success("dev directory created");
        } catch (e) {
            Logger.error("could not create dev directory");
            throw e;
        }
        Logger.log("writing project config");
        try {
            await fs.writeFile(
                path.join(projectDir, "ttpgcfg.project.json"),
                JSON.stringify(
                    {
                        name: projectTitle,
                        slug: projectSlug,
                        version: projectVersion,
                        template,
                        guid: {
                            dev: devGuid,
                            prd: prdGuid,
                        },
                    },
                    null,
                    2
                )
            );
            Logger.success("project config written");
        } catch (e) {
            Logger.error("could not write project config file");
            throw e;
        }
        if (ttpg_path) {
            Logger.log("writing local config...");
            try {
                await fs.writeFile(path.join(projectDir, "ttpgcfg.local.json"), JSON.stringify({ ttpg_path }, null, 2), "utf-8");
                Logger.success("local config created");
            } catch (e) {
                Logger.warning("could not write local config file");
            }
        } else {
            Logger.warning("no ttpg path provided - skipping local config creation");
        }
        Logger.log("installing workspace dependencies...");
        try {
            await runInstaller(projectDir);
            Logger.success("workspace dependencies installed");
        } catch (e) {
            Logger.error("could not install workspace dependencies");
            throw e;
        }
    } else {
        throw Error("project title is required");
    }
};

Logger.welcome();
buildProject()
    .then(() => {
        Logger.complete();
    })
    .catch((e) => {
        Logger.error("something went wrong");
        console.error(e);
    });
