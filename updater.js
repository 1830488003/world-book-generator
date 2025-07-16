//
// SillyTavern Extension Updater - Based on a working example from JS-Slash-Runner
//

const GITHUB_USER = '1830488003';
const GITHUB_REPO = 'world-book-generator';
const GITHUB_BRANCH = 'main';
const MANIFEST_PATH = 'manifest.json';

const LOCAL_MANIFEST_PATH = `/scripts/extensions/third-party/world-book-generator/${MANIFEST_PATH}`;

let localVersion;
let remoteVersion;

/**
 * Fetches raw file content from the GitHub repository using the official API.
 * @param {string} filePath - The path to the file in the repository.
 * @returns {Promise<string>} The content of the file.
 */
async function fetchRawFileContentFromGitHub(filePath) {
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
    const headers = {
        'Accept': 'application/vnd.github.v3.raw',
        'Cache-Control': 'no-cache',
    };

    try {
        const response = await fetch(url, { method: 'GET', headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch from GitHub API: ${response.status} ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        console.error('[WBG-Updater] Error fetching file from GitHub:', error);
        throw error;
    }
}

/**
 * Parses the version from a JSON file content.
 * @param {string} content - The JSON content.
 * @returns {string} The version string.
 */
function parseVersionFromFile(content) {
    try {
        const data = JSON.parse(content);
        if (data && typeof data.version === 'string') {
            return data.version;
        }
        throw new Error("Invalid manifest format: 'version' field is missing or not a string.");
    } catch (error) {
        console.error('[WBG-Updater] Error parsing version from file:', error);
        throw error;
    }
}

/**
 * Compares two semantic version strings (e.g., "1.2.3").
 * @param {string} versionA
 * @param {string} versionB
 * @returns {number} > 0 if A > B, < 0 if A < B, 0 if A === B.
 */
function compareSemVer(versionA, versionB) {
    const partsA = versionA.split('.').map(Number);
    const partsB = versionB.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }
    return 0;
}

/**
 * Fetches the local version from the extension's manifest file.
 * @returns {Promise<string>} The local version number.
 */
async function getLocalVersion() {
    if (localVersion) return localVersion;
    try {
        const response = await fetch(`${LOCAL_MANIFEST_PATH}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Could not fetch local manifest: ${response.statusText}`);
        }
        const content = await response.text();
        localVersion = parseVersionFromFile(content);
        return localVersion;
    } catch (error) {
        console.error('[WBG-Updater] Could not get local version.', error);
        // Return a base version to allow updates even if local check fails
        return '0.0.0';
    }
}

/**
 * Triggers the SillyTavern backend to update the extension.
 */
async function triggerUpdate() {
    const { getRequestHeaders } = SillyTavern.getContext();
    const toastr = window.toastr;

    if (!toastr) {
        console.error('[WBG-Updater] Toastr not available.');
        return;
    }

    toastr.info(`[一键做卡工具] 发现新版本 ${remoteVersion}，正在后台静默更新...`);
    try {
        const response = await fetch('/api/extensions/update', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extensionName: 'world-book-generator',
                global: false,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || response.statusText);
        }

        const data = await response.json();
        if (data.isUpToDate) {
            console.log('[WBG-Updater] Extension is already up to date.');
        } else {
            toastr.success('[一键做卡工具] 已成功更新至最新版本！页面将在3秒后自动刷新以应用更改。');
            setTimeout(() => location.reload(), 3000);
        }
    } catch (error) {
        console.error('[WBG-Updater] Update failed:', error);
        toastr.error(`[一键做卡工具] 自动更新失败: ${error.message}`);
    }
}


/**
 * Checks for updates and automatically triggers the update if a new version is available.
 */
export async function checkForUpdates() {
    console.log('[WBG-Updater] Checking for updates...');
    try {
        const [local, remoteManifest] = await Promise.all([
            getLocalVersion(),
            fetchRawFileContentFromGitHub(MANIFEST_PATH),
        ]);

        remoteVersion = parseVersionFromFile(remoteManifest);

        console.log(`[WBG-Updater] Local version: ${local}, Remote version: ${remoteVersion}`);

        if (compareSemVer(remoteVersion, local) > 0) {
            console.log(`[WBG-Updater] New version ${remoteVersion} available! Triggering automatic update.`);
            await triggerUpdate();
        } else {
            console.log('[WBG-Updater] Already up to date.');
        }
    } catch (error) {
        console.error('[WBG-Updater] Update check failed:', error);
    }
}
