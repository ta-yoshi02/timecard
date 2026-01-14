import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Default to JST
dayjs.tz.setDefault('Asia/Tokyo');

// Helper to get JST dayjs object
// If date is passed, parses it in JST context (or converts to JST)
const date = (date?: dayjs.ConfigType) => {
    return dayjs(date).tz('Asia/Tokyo');
};

export type { Dayjs } from 'dayjs';
export default date;
export { dayjs };
