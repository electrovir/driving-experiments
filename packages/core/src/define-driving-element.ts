import {wrapDefineElement} from 'element-vir';

/** Same as element-vir's `defineElement` but requires a `driving-` tag name prefix. */
export const defineDrivingElement = wrapDefineElement<`driving-${string}`>();
