# What is this?

create-ttpg-package is a way to start building a new package for Tabletop Playground.

## Requirements

Node (v16+ recommended)
Yarn (more on why in a minute)

## Usage

typescript:

`yarn create ttpg-package my-package --template ts` (recommended)

or

`npx create-ttpg-package my-package --template ts`

vanilla javascript:

`yarn create ttpg-package my-package --template js`

or

`npx create-ttpg-package my-package --template js`

## Directories of Interest...

Once the workspace is initialized, you should find several points of interest.

-   `src/**` is where your scripts will go. Anything within `src/` will be part of the package
-   `assets/**` is where you can keep your static assets that aren't scripts - for example, Textures and 3d Models that your package uses. You'll find any items that ttpg generates in here as well, such as thumbnails.
-   `dev/` as part of the development process, create-ttpg-package will create this folder, and symlink it into your ttpg folder. This allows you to work directly within ttpg during your package development. You'll find your packaged marked with (Dev) within TTPG - that's this.

## What else can I do?

-   `yarn setup` or `ttpg-scripts setup` - this will ensure you have all the needed configuration files and that the asset folders are created. You shouldn't need to run this unless something went wrong during the initialization of the workspace.
-   `yarn dev` or `ttpg-scripts dev` - this will create your './dev/ folder, transpile (or copy) your existing './src/' folder into './dev/Scripts/' and will symlink './dev/' into your ttpg folder. Net effect is that your development version will be available within ttpg.
-   `yarn clean` or `ttpg-scripts clean` - this will remove your ./dev/ folder (it's okay, nothing will actually be lost), and will remove your development build from TTPG.
-   `yarn reset` or `ttpg-scripts reset` - same as clean, but will also remove your local config file and ask you for your ttpg directory again.
-   `yarn build` or `ttpg-scripts build` - will create a production version of your package right into your ttpg folder (assuming one isn't there already). Once created, you'll be able to publish your package from within TTPG.
-   `yarn purge` or `ttpg-scripts purge` - this, once you confirm, will remove an existing production build from your ttpg folder. Proceed with caution. you can pass `-y` to override the confirmation, but don't do that unless you know what you're doing.

## Why Yarn?

one of the build steps that create-ttpg-package comes with will transpile (if you're using typescript) or copy (if you're using vanilla javascript) your ./src/ folder into your development and production builds. Part of that includes gathering any dependencies that your scripts might have. Yarn is the only package manager that I know of that can gather production dependencies and shove them in a folder, thus, yarn is required.
