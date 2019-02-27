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

    //standard move
    let move = 'left';

    let data = request.body;
    let directions = ['left', 'right', 'up', 'down'];
    let offsets = [[-1, 0],[1, 0],[0, -1],[0, 1]];
    let chances = [100, 100, 100, 100];

    // let NextMovement = {left: {move: 'left', offset: [-1, 0], chance: 100}, right: {move: 'right', offset: [1, 0], chance: 100}, up: {move: 'up', offset: [0, -1], chance: 100}, down: {move: 'down', offset: [0, 1], chance: 100}};

    let MySnakesHead = data.you.body[0];
    let MyLength = data.you.body.length;

    let TestedOffsets = [[0, 0]];

    //Initialize GameBoard Array

    /*
     * NULL: 0,
     * SNAKETAIL: 1,
     * SNAKE: 2,
     * SNAKEHEAD: 3,
     * FOOD: -4
    */

    let GameBoard = Array(data.board.width - 1).fill(Array(data.board.width - 1).fill(0));
    initializeSnakes();

    function initializeSnakes() {
        for (snake of data.board.snakes) {
            for (tile of snake.body) {
                if (tile == snake.body[0]) {
                    GameBoard[tile.x][tile.y] += 1;
                }
                if (tile == snake.body[snake.body.length - 1]) {
                    GameBoard[tile.x][tile.y] -= 1;
                }
                GameBoard[tile.x][tile.y] += 2;
            }
        }
    }

    initializeFoods();

    function initializeFoods() {
        for (food of data.board.food) {
            GameBoard[food.x][food.y] -= 4
        }
    }


    // get nearest piece of food as PrimalFood
    let MinimumDistancedFood = Infinity;
    for (let food of data.board.food) {
        let distance = Math.abs(food.x - MySnakesHead.x) + Math.abs(food.y - MySnakesHead.y);
        if (distance < MinimumDistancedFood) {
            MinimumDistancedFood = distance;
            PrimalFood = food;
        }
    }

    // calculate remaining space as RemainingArea
    let BoardArea = data.board.height * data.board.width;
    let RemainingArea = BoardArea;
    for (let snake of data.board.snakes) {
        RemainingArea -= snake.body.length;
    }

    // test offsets if possible to play
    for (let o = 0; o < 4; o++) {
        if (ObstacleOnPosition(offsets[o])) {
            chances[o] = 0;
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
    FoodInfluences();

    function FoodInfluences() {
        let OffsetToPrimalFood = [PrimalFood.x - MySnakesHead.x, PrimalFood.y - MySnakesHead.y];
        if (data.you.health <= 40) {
            ChanceChange = 25;
        } else {
            ChanceChange = 0;
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
    }
    
    // influence of next moving possibilities
    NextMoveInfluences();

    function NextMoveInfluences() {
        for (let i = 0; i < 4; i++) {
            difference = 0;
            for (let offset of offsets) {
                if (ObstacleOnPosition([offsets[i][0] + offset[0], offsets[i][1] + offset[1]]) && chances[i] > 0) {
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
    }
    

    // Test for close room < 10 on neighbour fields
    // just for left direction now
    for (let d = 0; d < 4; d++) {
        let StartField = MySnakesHead;

        let LeftField = getNeighbourField(StartField, d);
        let FreeFields = [];
        let i = 0;
        getAllFreeFields(LeftField);

        function getAllFreeFields(field) {

            let FreeDirections = [];

            for (let direction = 0; direction < 4, direction++) {

                let TestThisField = getNeighbourField(field, direction);
                if (!ObstacleOnPosition(TestThisField)) {
                    if (!ElementInArray(TestThisField, FreeFields)) {
                        i++;
                        FreeFields.push(TestThisField);
                        FreeDirections.push(direction);
                    }
                }
            }

            if (i <= 10) {
                for (let direction of FreeDirections) {
                    getAllFreeFields(getNeighbourField(field, direction));
                }
            }

        }

        function getNeighbourField(StartField, direction) {
            // direction : {left: 0, right: 1, up: 2, down: 3}
            let NeighbourField = [offsets[direction][0] + StartField.x, offsets[direction][1] + StartField.y];
            return NeighbourField;
        }

        console.log(FreeFields.length);

        if (FreeFields.length >= 10) {
            //increased chance for direction
        } else {    
            //decrease chance for direction proportional to FreeFields.length
            chances[d] -= Int(Math.pow(FreeFields.length, -1) * 80);
            
            //test if there will be a exit in x moves
            //change chance for direction proportinal to chance for exit
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

    // logs
    console.log(data.turn);
    /*for (let i = 0; i < 4; i++) {
    console.log(chances[i]);
    }*/

    // Response data
    const ResponseData = {
        move: nextMove, // one of: ['up','down','left','right']
    }

    return response.json(ResponseData);

  /*function TunnelHasExit (StartOffset) {
    //teste von StartOffset alle Nachbarfelder ob frei
    //ignoriere bereits getestete Felder
    let FreeOffset;
    let CountFreeOffsets = 0;

    for (offset of offsets) {
      let OffOffset = [StartOffset[0] + offset[0], StartOffset[1] + offset[1]];

      if (!ElementInArray(OffOffset, TestedOffsets)) {
        TestedOffsets[TestedOffsets.length] = OffOffset;
        if (!ObstacleOnPosition(OffOffset)) {
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

    
  }*/

    function ElementInArray(elem, arr) {
        let FLAG = false;
        for (element of arr) {
            if (element == elem) {
                FLAG = true;
            }
        }
        return FLAG;
    }

    function ObstacleOnPosition (offset) {
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

        //test for snake
        if (GameBoard[position.x][position.y] != 0 && GameBoard[position.x][position.y] > -3) {
            FLAG = true;
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

app.use('*', fallbackHandler)
app.use(notFoundHandler)
app.use(genericErrorHandler)

app.listen(app.get('port'), () => {
  console.log('Server listening on port %s', app.get('port'))
})
