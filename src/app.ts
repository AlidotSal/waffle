import endorphin from 'endorphin';

import * as App from './app-component/app-component.html';

endorphin('app-component', App, {
	target: document.body
});