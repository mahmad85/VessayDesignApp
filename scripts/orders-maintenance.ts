import 'dotenv/config';
import { getDatabase } from '../src/db/client';
import { recordOverdue } from '../src/db/order-repository';
import { dispatchNotifications } from '../src/modules/notifications/dispatch';
await (await getDatabase()).transaction((q) => recordOverdue(q));
await dispatchNotifications();
console.log('Order review deadlines checked and pending notification batch processed.');
process.exit(0);
