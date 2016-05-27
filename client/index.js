import React from 'react';
import { render } from 'react-dom';
import { Router, browserHistory } from 'react-router';
import { Provider } from 'react-redux';

import createStore from './store/createStore.js';

export const store = createStore();

import routes from './routes.js';

const dest = document.getElementById('contents');

export default render((
  <Provider store={store}>
    <Router history={browserHistory}>
      {routes}
    </Router>
  </Provider>
), dest);
