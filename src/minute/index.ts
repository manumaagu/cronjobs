"use strict";

import * as dotenv from 'dotenv';
import { checkAndPostLinkedin, checkAndPostTweets, checkAndPostYoutube } from '../utils/cronjobs';

dotenv.config();

checkAndPostLinkedin();
checkAndPostTweets();
checkAndPostYoutube();