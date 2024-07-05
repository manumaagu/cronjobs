"use strict";

import * as dotenv from 'dotenv';
import { checkAndPostLinkedin, checkAndPostTweets, checkAndPostYoutube, checkStatistics } from './utils/cronjobs';

dotenv.config();

if (process.env.CRON_TYPE === 'day') {
    checkStatistics();
} else {
    checkAndPostLinkedin();
    checkAndPostTweets();
    checkAndPostYoutube();
}