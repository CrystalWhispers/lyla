import { handle } from '../../public/shared/handler.js';

export const onRequest = (context) => handle(context.request, context.env);
