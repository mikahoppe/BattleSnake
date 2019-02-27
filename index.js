const bodyParser = require('body-parser')
const express = require('express')
const logger = require('morgan')
const app = express()
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require('./handlers.js')

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set('port', (process.env.PORT || 9001))

app.enable('verbose errors')

app.use(logger('dev'))
app.use(bodyParser.json())
app.use(poweredByHandler)

// --- SNAKE LOGIC GOES BELOW THIS LINE ---

// Handle POST request to '/start'
app.post('/start', (request, response) => {
  // NOTE: Do something here to start the game

  // Response data
  const data = {
    color: '#CA7008',
    "headType": "pixel",
    "tailType": "freckled",
  }

  return response.json(data)
})










// Handle POST request to '/move'
app.post('/move', (request, response) => {

  let move = 'left';

  let data = request.body;
  let directions = ['left', 'right', 'up', 'down'];
  let offsets = [[-1, 0],[1, 0],[0, -1],[0, 1]];
  let chances = [100, 100, 100, 100];

  let NextMovement = {left: {move: 'left', offset: [-1, 0], chance: 100}, right: {move: 'right', offset: [1, 0], chance: 100}, up: {move: 'up', offset: [0, -1], chance: 100}, down: {move: 'down', offset: [0, 1], chance: 100}};

  let MySnakesHead = data.you.body[0];
  let MyLength = data.you.body.length;

  let TestedOffsets = [[0, 0]];


  // get nearest piece of food
  let MinimumDistancedFood = Infinity;
  for (let food of data.board.food) {
    let distance = Math.abs(food.x - MySnakesHead.x) + Math.abs(food.y - MySnakesHead.y);
    if (distance < MinimumDistancedFood) {
      MinimumDistancedFood = distance;
      PrimalFood = food;
    }
  }

  // calculate remaining space
  let BoardArea = data.board.height * data.board.width;
  let RemainingSpace = BoardArea;
  for (let snake of data.board.snakes) {
    RemainingSpace -= snake.body.length;
  }

  // test offsets if possible to play
  for (let i = 0; i < 4; i++) {
    if (checkIfObstacleOnPosition(offsets[i])) {
      chances[i] = 0;
    }
  }

  // get nearest snake and its length
  let snakes = [];
  for (snake of data.board.snakes) {
    let DistanceToMySnakeHead = Math.abs(snake.x - MySnakesHead.x) + Math.abs(snake.y - MySnakesHead.y);
    let SnakeLength = snake.body.length;
    snakes.push({x: snake.x, y: snake.y, distance: DistanceToMySnakeHead, length: SnakeLength});

    // configure chances on next movement
    let ChanceChange = SnakeLength >= MyLength ? -75 : 25;

    if (DistanceToMySnakeHead == 2) {
      let OffsetToMySnakesHead = {x: snake.x - MySnakesHead.x, y: snake.y - MySnakesHead.y};
      if (OffsetToMySnakesHead.x < 0 && chances[0] > 0) {
        chances[0] += ChanceChange;
      } else if (OffsetToMySnakesHead.x > 0 && chances[1] > 0) {
        chances[1] += ChanceChange;
      }
      if (OffsetToMySnakesHead.y < 0 && chances[2] > 0) {
        chances[2] += ChanceChange;
      } else if (OffsetToMySnakesHead.y > 0 && chances[3] > 0) {
        chances[3] += ChanceChange;
      }
    } 
  }

  // influence of food
  let OffsetToPrimalFood = [PrimalFood.x - MySnakesHead.x, PrimalFood.y - MySnakesHead.y];
  if (data.you.health <= 40) {
    ChanceChange = 25;
  } else {
    ChanceChange = 5;
  }
  if (OffsetToPrimalFood[0] < 0 && chances[0] > 0) {
    chances[0] += ChanceChange;
  } else if (OffsetToPrimalFood[0] > 0 && chances[1] > 0) {
    chances[1] += ChanceChange;
  }
  if (OffsetToPrimalFood[1] < 0 && chances[2] > 0) {
    chances[2] += ChanceChange;
  } else if (OffsetToPrimalFood[1] > 0 && chances[3] > 0) {
    chances[3] += ChanceChange;
  }

  // influence of next moving possibilities
  for (let i = 0; i < 4; i++) {
    difference = 0;
    for (let offset of offsets) {
      if (checkIfObstacleOnPosition([offsets[i][0] + offset[0], offsets[i][1] + offset[1]]) && chances[i] > 0) {
        difference += 10;
      }
    }
    if (difference >= 30 && chances[i] > 0) {
      //Teste Ausweg aus Tunnel
      TestedOffsets = [[0, 0]];
      if (TunnelHasExit(offsets[i])) {
        chances[i] = 40;
      } else {
        chances[i] = 35;
      }
    } else {
      chances[i] -= difference;
    }
  }
  
  for (let i = 0; i < 4; i++) {
    for (snake of data.board.snakes) {
      position = [MySnakesHead.x + offsets[i][0], MySnakesHead.y + offsets[i][1]];
  
      //test for next move head of other snake
      for (let offset of offsets) {
        if (snake.body[0].x == position[0] + offset[0] && snake.body[0].y == position[1] + offset[1] && snake.id != data.you.id && chances[i] > 0) {
          if (snake.body.length >= MyLength) {
            chances[i] -= 30;
          } else {
            chances[i] += 30;
          }
        }
      }
    }
  }

  //Return Move
  let max = -Infinity;
  let nextMove = 'left';
  for (let i = 0; i < 4; i++) {
    if (chances[i] > max) {
      max = chances[i];
      nextMove = directions[i];
    }
  }

  console.log(data.turn);
  /*for (let i = 0; i < 4; i++) {
    console.log(chances[i]);
  }*/

  // Response data
  const ResponseData = {
    move: nextMove, // one of: ['up','down','left','right']
  }

  return response.json(ResponseData);

  function TunnelHasExit (StartOffset) {
    //teste von StartOffset alle Nachbarfelder ob frei
    //ignoriere bereits getestete Felder
    let FreeOffset;
    let CountFreeOffsets = 0;

    for (offset of offsets) {
      let OffOffset = [StartOffset[0] + offset[0], StartOffset[1] + offset[1]];

      if (!ElementInArray(OffOffset, TestedOffsets)) {
        TestedOffsets[TestedOffsets.length] = OffOffset;
        if (!checkIfObstacleOnPosition(OffOffset)) {
          CountFreeOffsets += 1;
          FreeOffset = OffOffset;
        }
      }
    }
    if (CountFreeOffsets == 1) {
      return TunnelHasExit(FreeOffset);
    } else if (CountFreeOffsets == 0) {
      return false;
    } else {
      return true;
    }

    function ElementInArray (elem, arr) {
      let FLAG = false;
      for (element of arr) {
        if (element == elem) {
          FLAG = true;
        }
      }
      return FLAG;
    }
  }

  function checkIfObstacleOnPosition (offset) {
    let FLAG = false;
    let position = {x: 0, y: 0};
    position.x = MySnakesHead.x + offset[0];
    position.y = MySnakesHead.y + offset[1];

    //test for border
    if (position.x < 0 || position.x > data.board.width - 1) {
      FLAG = true;
    }
    if (position.y < 0 || position.y > data.board.height - 1) {
      FLAG = true;
    }

    //test for own snake
    for (let bodypart of data.you.body) {
      if (bodypart != data.you.body[data.you.body.length - 1]) {
        if (position.x == bodypart.x && position.y == bodypart.y) {
          FLAG = true;
        }
      }
    }

    //test for other snake
    for (let snake of data.board.snakes) {
      for (let bodypart of snake.body) {
        if (bodypart != snake.body[snake.body.length - 1]) {
          if (position.x == bodypart.x && position.y == bodypart.y) {
            FLAG = true;
          }
        } 
      }
    }

    return FLAG;
  }

  function GetSnakeAndPositionToTile (tile) {

    for (let i = 0; i < data.you.body.length; i++) {
      let body = data.you.body[i];
      if (body.x == tile[0] && body.y == tile[1]) {
        return [you, i];
      }
    }
    for (snake of data.board.snakes) {
      for (let i = 0; i < snake.body.length; i++) {
        let body = snake.body[i];
        if (body.x == tile[0] && body.y == tile[1]) {
          return [snake, i];
        }
      }
    }
    return [NULL, NULL];
  }
})

app.post('/end', (request, response) => {
  // NOTE: Any cleanup when a game is complete.
  return response.json({})
})

app.post('/ping', (request, response) => {
  // Used for checking if this snake is still alive.
  return response.json({});
})

// --- SNAKE LOGIC GOES ABOVE THIS LINE ---
















app.use('*', fallbackHandler)
app.use(notFoundHandler)
app.use(genericErrorHandler)

app.listen(app.get('port'), () => {
  console.log('Server listening on port %s', app.get('port'))
})
