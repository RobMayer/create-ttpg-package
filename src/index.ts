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

const projectName = process.argv[2];

if (!projectName) {
    console.error(chalk.redBright("Project Name is Required"));
    process.exit(-1);
}

const projectSlug = projectName.split("/").pop() ?? projectName;

const template = process.argv.indexOf("--template") > -1 ? process.argv[process.argv.indexOf("--template") + 1] ?? "javascript" : "javascript";

if (!SUPPORTED_TEMPLATES.includes(template as keyof typeof TEMPLATE_ALIASES)) {
    console.error(chalk.redBright(`unknown template '${template}'`));
    process.exit(-1);
}

const projectDir = path.resolve(process.cwd(), projectSlug);
const templateDir = path.resolve(__dirname, "..", "templates", TEMPLATE_ALIASES[template as keyof typeof TEMPLATE_ALIASES]);

const runInstaller = async () => {
    return new Promise((resolve, reject) => {
        const child = spawn("yarn", ["install"], { stdio: "pipe", cwd: projectDir });
        child.on("close", (code: number) => (code > 0 ? reject(code) : resolve(0)));
    });
};

const getSuggestedTTPGPath = (): string | null => {
    if (process.platform === "darwin") {
        return path.resolve(process.env.HOME + "/Library/Application Support/Epic/TabletopPlayground/Package");
    } else if (process.platform === "win32") {
        return path.resolve("C:\\Program Files (x86)\\Steam\\steamapps\\common\\TabletopPlayground\\TabletopPlayground\\PersistentDownloadDir");
    }
    return null;
};

const guid = () => uuid().replace(/-/g, "").toUpperCase();

const buildProject = async () => {
    const input = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        await fs.mkdir(projectDir, { recursive: true });
    } catch (e) {
        console.error(chalk.redBright("could not create project folder"));
        throw e;
    }
    try {
        await fs.cp(templateDir, projectDir, { recursive: true });
        await fs.rename(path.join(projectDir, "gitignore"), path.join(projectDir, ".gitignore"));
        await fs.rename(path.join(projectDir, "template.json"), path.join(projectDir, "package.json"));
    } catch (e) {
        console.error(chalk.redBright("could not copy template into project folder"));
        throw e;
    }
    const projectPackage = JSON.parse(await fs.readFile(path.join(projectDir, "package.json"), "utf-8"));
    projectPackage.name = projectName;
    await fs.writeFile(path.join(projectDir, "package.json"), JSON.stringify(projectPackage, null, 2));

    const projectTitle = await input.question(chalk.whiteBright("What is your packages title?"));
    if (projectTitle) {
        const suggestedPrdGuid = guid();
        const inputPrdGuid = (await input.question(chalk.whiteBright(`Provide a production GUID for your package (or 'enter' to use the provided value) [${chalk.white(suggestedPrdGuid)}]: `))).trim();
        const prdGuid = inputPrdGuid !== "" ? inputPrdGuid : suggestedPrdGuid;
        const suggstedDevGuid = guid();
        const inputDevGuid = (await input.question(chalk.whiteBright(`Provide a development GUID for your package (or 'enter' to use the provided value) [${chalk.white(suggstedDevGuid)}]: `))).trim();
        const devGuid = inputDevGuid !== "" ? inputDevGuid : suggstedDevGuid;
        const suggestedTTPGPath = getSuggestedTTPGPath();
        const input_ttpg_path = (await input.question(chalk.whiteBright(`What is your TTPG path ${suggestedTTPGPath ? `[${chalk.white(suggestedTTPGPath)}]: ` : ": "}`))).trim();
        const ttpg_path = input_ttpg_path !== "" ? input_ttpg_path : suggestedTTPGPath;
        input.close();
        try {
            await Promise.all(ASSET_DIRS.map((dir) => fs.mkdir(path.join(projectDir, "assets", dir), { recursive: true })));
        } catch (e) {
            console.error(chalk.redBright("could not create asset directories"));
            throw e;
        }
        try {
            await fs.mkdir(path.join(projectDir, "dev"), { recursive: true });
            await fs.writeFile(
                path.join(projectDir, "dev", "Manifest.json"),
                JSON.stringify(
                    {
                        Name: `${projectTitle} (Dev)`,
                        Version: "0.0.1",
                        GUID: devGuid,
                    },
                    null,
                    2
                ),
                "utf-8"
            );
            await Promise.all(ASSET_DIRS.map((dir) => fs.symlink(path.join(projectDir, "assets", dir), path.join(projectDir, "dev", dir), "junction")));
        } catch (e) {
            console.error(chalk.redBright("could not create dev directory"));
            throw e;
        }
        try {
            await fs.writeFile(
                path.join(projectDir, "ttpgcfg.project.json"),
                JSON.stringify(
                    {
                        name: projectTitle,
                        slug: projectSlug,
                        guid: {
                            dev: devGuid,
                            prd: prdGuid,
                        },
                    },
                    null,
                    2
                )
            );
        } catch (e) {
            console.error(chalk.redBright("Could not write project config file"));
            throw e;
        }
        if (ttpg_path) {
            try {
                await fs.writeFile(path.join(projectDir, "ttpgcfg.local.json"), JSON.stringify({ ttpg_path }, null, 2), "utf-8");
                try {
                    await fs.symlink(path.join(projectDir, "dev"), path.join(path.resolve(ttpg_path), `${projectSlug}_dev`), "junction");
                } catch (e) {
                    console.warn(chalk.redBright("Could not symlink to ttpg folder, you will need to run the setup script"));
                }
            } catch (e) {
                console.warn(chalk.redBright("Could not write local config file, you will need to run the setup script"));
            }
        } else {
            console.warn(chalk.yellowBright("No ttpg path provided, you will need to run the setup script later"));
        }
    } else {
        console.warn(chalk.yellowBright("No title was provided, you will need to run the setup script later"));
    }
    await runInstaller();
};

buildProject()
    .then(() => {
        console.log(chalk.greenBright("Good Hunting!"));
    })
    .catch((e) => {
        console.error(chalk.redBright("Something when wrong"));
        console.error(e);
    });
