var https = require("https");
var fs = require("fs");

// Disable SSL certificate verification for asset downloads
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const CONFIG_FILE_NAME = "mempool-frontend-config.json";
let configContent = {};

var PATH;
if (process.argv[2]) {
  PATH = process.argv[2];
}

if (!PATH) {
  throw new Error("Resource path argument is not set");
}

try {
  const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
  configContent = JSON.parse(rawConfig);
  console.log(`${CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
  if (e.code !== "ENOENT") {
    throw new Error(e);
  } else {
    console.log(`${CONFIG_FILE_NAME} file not found, using default config`);
  }
}

function download(filename, url) {
  // Ensure directory exists
  const dir = filename.substring(0, filename.lastIndexOf('/'));
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  https
    .get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode > 299) {
        console.error(
          "HTTP Error " +
            response.statusCode +
            " while fetching '" +
            filename +
            "'"
        );
        return;
      }
      response.pipe(fs.createWriteStream(filename));
    })
    .on("error", function (e) {
      console.error(`Failed to download ${filename}: ${e.message}`);
    });
}

function downloadMiningPoolLogos() {
  const options = {
    host: "api.github.com",
    path: "/repos/meowcoin-foundation/mining-pool-logos/contents/",
    method: "GET",
    headers: { "user-agent": "node.js" },
  };

  https.get(options, (response) => {
    let chunks_of_data = [];

    response.on("data", (fragments) => {
      chunks_of_data.push(fragments);
    });

    response.on("end", () => {
      let response_body = Buffer.concat(chunks_of_data);
      try {
        const poolLogos = JSON.parse(response_body.toString());
        for (const poolLogo of poolLogos) {
          download(
            `${PATH}/mining-pools/${poolLogo.name}`,
            poolLogo.download_url
          );
        }
      } catch (e) {
        console.error(
          `Unable to download mining pool logos. Trying again at next restart. Reason: ${
            e instanceof Error ? e.message : e
          }`
        );
      }
    });

    response.on("error", (error) => {
      console.error(`Failed to download mining pool logos: ${error.message}`);
    });
  });
}

let assetsJsonUrl =
  "https://raw.githubusercontent.com/mempool/asset_registry_db/master/index.json";
let assetsMinimalJsonUrl =
  "https://raw.githubusercontent.com/mempool/asset_registry_db/master/index.minimal.json";

const testnetAssetsJsonUrl =
  "https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.json";
const testnetAssetsMinimalJsonUrl =
  "https://raw.githubusercontent.com/Blockstream/asset_registry_testnet_db/master/index.minimal.json";

console.log("Downloading assets");
download(PATH + "/assets.json", assetsJsonUrl);
console.log("Downloading assets minimal");
download(PATH + "/assets.minimal.json", assetsMinimalJsonUrl);
console.log("Downloading testnet assets");
download(PATH + "/assets-testnet.json", testnetAssetsJsonUrl);
console.log("Downloading testnet assets minimal");
download(PATH + "/assets-testnet.minimal.json", testnetAssetsMinimalJsonUrl);
console.log("Downloading mining pool logos");
downloadMiningPoolLogos();
