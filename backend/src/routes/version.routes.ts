import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Read build metadata
const getBuildInfo = () => {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
    );

    const buildTime = process.env.BUILD_TIME || new Date().toISOString();
    const gitCommit = process.env.GIT_COMMIT || 'unknown';

    return {
      version: packageJson.version,
      buildTime,
      gitCommit: gitCommit.substring(0, 7),
      nodeVersion: process.version
    };
  } catch (error) {
    return {
      version: 'unknown',
      buildTime: new Date().toISOString(),
      gitCommit: 'unknown',
      nodeVersion: process.version
    };
  }
};

/**
 * Get current build version
 * This endpoint is used by the frontend to detect when a new version is available
 */
router.get('/version', (req, res) => {
  const buildInfo = getBuildInfo();
  res.json({
    success: true,
    ...buildInfo
  });
});

export default router;