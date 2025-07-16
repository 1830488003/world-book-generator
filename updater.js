//
// SillyTavern Extension Updater - Simplified Manual Update Notification
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
    const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;

    try {
        // Add a cache-busting query parameter
        const response = await fetch(`${url}?t=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch raw file from GitHub: ${response.status} ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        console.error('[WBG-Updater] Error fetching raw file from GitHub:', error);
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
        return '0.0.0'; // Fallback
    }
}

/**
 * Shows a toast notification instructing the user to update manually.
 */
function showUpdateNotification() {
    const toastr = window.toastr;
    if (!toastr) {
        console.error('[WBG-Updater] Toastr not available.');
        return;
    }

    const message = `请点击右上角扩展菜单 -> 管理扩展，然后找到【一键做卡工具】并点击右侧的下载按钮进行更新。`;
    const title = `发现新版本 v${remoteVersion}`;

    toastr.info(message, title, {
        timeOut: 30000, // 30 seconds
        extendedTimeOut: 10000,
        closeButton: true,
        tapToDismiss: false,
    });
}


/**
 * Checks for updates and notifies the user if a new version is available.
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
            console.log(`[WBG-Updater] New version ${remoteVersion} available! Notifying user.`);
            showUpdateNotification();
        } else {
            console.log('[WBG-Updater] Already up to date.');
        }
    } catch (error) {
        console.error('[WBG-Updater] Update check failed:', error);
    }
}
