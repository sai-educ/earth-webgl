import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

/* GET home page. */
router.get('/', (req, res) => {
    res.render('index', {
        title: 'Earth WebGL Demo'
    });
});

export default router;