import { expect } from 'chai';
import axios from 'axios';

import { start, stop } from '_server/server.js';

describe('Web Server testing', () => {
  before('Starting server', () => start()
    .then(() => console.log(`Server running at http://localhost:${PORT}/`))
  );

  after('Closing the server', () => stop()
    .then(() => console.log(`Closing server at  http://localhost:${PORT}/`))
  );

  describe('Static pages test', () => {
    const http = axios.create({
      baseURL: `${HOST}:${PORT}`,
    });

    it('Get / should return home page', () =>
      http.get('/')
        .then(response => {
          expect(response.status).to.equal(200);
          expect(response.headers['content-type']).to.contain('text/html');
          expect(response.data).to.contain('<title>Sample Web Page</title>');
          expect(response.data).to.contain('<script id="initialState" type="application/json">');
          expect(response.data).to.contain('<div id="contents"');
        })
    );
    it('Get /bootstrap should bring it', () =>
      http.get('/bootstrap/js/bootstrap.js')
        .then(response => {
          expect(response.status).to.equal(200);
          expect(response.headers['content-type']).to.contain('application/javascript');
          expect(response.data).to.contain('Bootstrap');
          expect(response.data).to.contain('Twitter');
        })
    );
  });
});
