"use strict";

import * as dotenv from 'dotenv';
import { checkStatistics } from '../utils/cronjobs';

dotenv.config();

checkStatistics();