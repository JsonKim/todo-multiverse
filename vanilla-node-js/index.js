const http = require("http");
const url = require('url');
const fs = require('fs');
const path = require('path');

const host = 'localhost';
const port = 8000;

// todo 목록을 저장할 배열
const todos = [];

// 클라이언의 요청을 처리하는 listener 함수
// 클라이언트가 서버로 보낸 정보는 req에 담기고
// 서버가 클라이언트로 정보를 보낼때는 res를 사용한다.
const requestListener = function (req, res) {

  // 테스트 페이지용 경로인 /todo-backend-js-spec 에 대해서 static file을 서빙하기 위한 사전 작업
  // 사용자가 요청한 경로를 추출한다.
  const parsedUrl = url.parse(req.url);
  const pathname = `.${parsedUrl.pathname}`;

  // 사용자가 요청한 경로가 /todo-backend-js-spec/ 으로 시작하는지 검사하고,
  // 만약 그렇다면 로컬 폴더의 해당 경로에서 파일을 찾는다.
  // 해당 검사에는 정규표현식을 사용한다.
  if (/^[\.]?\/todo-backend-js-spec/.test(pathname)) {
    // content-type 매핑을 위해 확장자를 가져온다.
    // content-type은 브라우저에게 파일의 종류(텍스트, 이미지, 영상등)를 알려주는 역할을 한다.
    const ext = path.parse(pathname).ext;
    // 확장자와 content-type 매핑을 위한 테이블
    const contentTypeTable = {
      '.ico': 'image/x-icon',
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword'
    };

    // 파일이 존재하는지 검사한다.
    const exist = fs.existsSync(pathname);
    // 파일이 존재하지 않으면 에러 처리한다.
    if(!exist) {
      // 존재하지 않는 리소스를 요청 했으므로 클라이언트에게
      // status code가 404라고 알려준다.
      res.statusCode = 404;
      // res.write를 사용하면 클라이언트에 데이터를 전송한다.
      res.write(`File ${pathname} not found!`);
      // res.end를 호출하면 클라이언트에게 더이상 보낼 데이터가 없음을 알려주어
      // 클라이언트가 현재의 요청을 완료 할 수 있도록 한다.
      res.end();
      return;
    }

    // 주어진 경로의 파일을 읽는다.
    // 파일을 읽는 등의 IO관련 작업은 보통 비동기로 처리하기 때문에
    // fs.readFile은 파일 읽기가 완료되면 실행될 함수(콜백함수)를 인자로 전달받는다.
    fs.readFile(pathname, function(err, data){
      if(err){
        // 파일을 읽는 도중 에러가 발생하면 status code를 500으로 지정한다.
        // status code 500은 internal server error를 의미한다.
        res.statusCode = 500;
        res.write(`Error getting the file: ${err}.`);
        res.end();
        return;
      }

      // 정상적으로 파일 내용 전송이 가능하기 때문에 status code는 200으로 지정한다.
      res.statusCode = 200;

      // 사용자가 요청한 파일의 확장자와 매핑할 content-type이 테이블에 없으면
      // text/plain 으로 지정한다.
      const contentType = contentTypeTable[ext] || 'text/plain';
      // res.setHeader를 사용하면 클라이언트에 보낼 http header를 지정 할 수 있다.
      res.setHeader('Content-type', contentType );

      // 파일 내용을 브라우저에 전달한다.
      res.write(data);
      res.end();
    });

    return;
  }

  if (req.method === 'POST' && req.url === '/') {
    // 클라이언트가 보내오는 데이터는 data 이벤트를 통해서 전달 받을 수 있다.
    // end 이벤트는 클라이언트가 모든 데이터를 전송하고 나면 발생되는 이벤트이다.
    // res.write, res.end와 비교해서 생각해 볼 수 있다.

    // 클라이언트가 보내온 데이터 전체를 복원하기 위한 변수
    let body = '';

    req.on('data', chunk => {
      // 서버 입장에서는 클라이언트가 몇 번에 걸쳐서 데이터를 보냈는지 알 수 없기 때문에
      // data 이벤트가 발생할 때 마다 전달 받은 데이터를 body에 쌓아서 전체 데이터를 복원해야 한다.
      body += chunk.toString();
    });

    req.on('end', () => {
      // 문자열 형태의 body를 json 으로 파싱한다.
      const todo = JSON.parse(body);

      // todo 아이템에 필요한 기본 항목을 생성하는 작업
      // id는 현재 todos 길이에 1을 더해서 사용한다. 1을 꼭 더할 필요는 없지만
      // id를 1부터 사용하기 위해서 이렇게 처리했다.
      todo.completed = false;
      todo.id = todos.length + 1;
      todo.url = `http://${req.headers.host}/todo/${todo.id}`;

      // 아이템을 todos 배열에 추가한다.
      todos.push(todo);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.write(JSON.stringify(todo));
      res.end();
    });

    return;
  }

  // todo list의 모든 항목을 삭제한다.
  if (req.method === 'DELETE' && req.url === '/') {
    // splice는 첫번째 인자는 제거할 위치의 인덱스를, 두번째 인자는 지울 갯수를 의미한다.
    // 따라서 다음 코드는 todos의 0번째 인덱스 위치부터 todos배열의 갯수만큼 지우게 된다.
    // 또한 splice는 인스턴스 자신을 변경하는 메서드이기 때문에 아래 코드는
    // todos에 있는 모든 원소를 삭제하게 된다.
    todos.splice(0, todos.length);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // 삭제했을때는 성공, 실패에 대한 여부만 알려주면 되기 때문에 status code 지정이외에
    // 다른 데이터는 전달하지 않아도 된다. 따라서 res.write는 사용하지 않았다.

    res.end();

    return;
  }

  // todo list의 모든 항목을 가져온다.
  if (req.method === 'GET' && req.url === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.write(JSON.stringify(todos));
    res.end();
    return;
  }

  // /todo/123 형태의 요청을 처리하기 위해 url이 /todo/로 시작하는지 검사한다.
  if (req.method === 'GET' && req.url.indexOf('/todo/') === 0) {
    // 정규식을 사용해서 /todo/ 뒤쪽의 문자열이 숫자로 이루어진 경우에만 캡쳐한다.
    const id = req.url.match(/^\/todo\/([0-9]+)/)?.[1];
    // 해당 id를 가진 todo 아이템의 index를 찾는다.
    // id 비교에는 ===(strict equal)대신 ==(non-strict equal)을 사용했는데
    // 대단한 이유가 있는 것은 아니고, 코드를 최대한 단순하게 작성하기 위해서이다.
    // 정규식을 사용해 캡쳐된 id는 문자열이고 todo의 아이템이 사용하는 id는 number이기 때문에
    // 타입은 무시하고 값만을 비교한다. 
    const targetIndexOfTodos = todos.findIndex((todo) => todo.id == id);

    // findIndex는 주어진 조건에 맞는 원소를 찾지 못하면 -1을 반환한다.
    if (targetIndexOfTodos === -1) {
      res.statusCode = 404;
      res.end();
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.write(JSON.stringify(todos[targetIndexOfTodos]));
    res.end();
    return;
  }

  // 주어진 id에 해당하는 todo 아이템을 업데이트 한다.
  if (req.method === 'PATCH' && req.url.indexOf('/todo/') === 0) {
    const id = req.url.match(/^\/todo\/([0-9]+)/)?.[1];
    const targetIndexOfTodos = todos.findIndex((todo) => todo.id == id);

    if (targetIndexOfTodos === -1) {
      res.statusCode = 404;
      res.end();
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const data = JSON.parse(body);
      
      // 클라이언트가 보내온 데이터로 todo 아이템을 업데이트 하기 위해
      // spread operator를 사용하였다.
      todos[targetIndexOfTodos] = { ...todos[targetIndexOfTodos], ...data };

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.write(JSON.stringify(todos[targetIndexOfTodos]));
      res.end();
    });

    return;
  }

  // 주어진 id에 해당하는 todo 아이템을 제거 한다.
  if (req.method === 'DELETE' && req.url.indexOf('/todo/') === 0) {
    const id = req.url.match(/^\/todo\/([0-9]+)/)?.[1];
    const targetIndexOfTodos = todos.findIndex((todo) => todo.id == id);

    if (targetIndexOfTodos === -1) {
      res.statusCode = 404;
      res.end();
      return;
    }

    // splice를 사용해서 targetIndexOfTodos 위치의 아이템 하나만 삭제한다.
    todos.splice(targetIndexOfTodos, 1);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end();

    return;
  }

  // 코드가 여기까지 실행이 되었다면 클라이언트가 요청한 리소소를 찾지 못한 것이다.
  // 따라서 not found 처리를 한다.
  res.statusCode = 404;
  res.end();
};

// requestListener를 사용해서 http 서버를 생성한다.
const server = http.createServer(requestListener);

// 생성된 서버를 listen 한다.
server.listen(port, host, () => {
  // 서버가 실행되면 로그를 출력한다.
  console.log(`Server is running on http://${host}:${port}`);
});
