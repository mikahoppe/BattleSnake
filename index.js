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
    let nextMove = 'left';

    let data = request.body;
    let directions = ['left', 'right', 'up', 'down'];
    let offsets = [[-1, 0],[1, 0],[0, -1],[0, 1]];
    let chances = [100, 100, 100, 100];

    let PrimalFood = data.board.food[0];

    // let NextMovement = {left: {move: 'left', offset: [-1, 0], chance: 100}, right: {move: 'right', offset: [1, 0], chance: 100}, up: {move: 'up', offset: [0, -1], chance: 100}, down: {move: 'down', offset: [0, 1], chance: 100}};

    let MySnakesHead = data.you.body[0];
    let MyLength = data.you.body.length;

    let TestedOffsets = [[0, 0]];

    console.log(data.turn);

    //Initialize GameBoard Array

    /*
     * NULL: 0,
     * FOOD: 1,
     * SNAKETAIL: 2,
     * SNAKE: 3,
     * SNAKEHEAD: 4
    */

    let GameBoard = new Array(data.board.width);
    for (let i = 0; i < GameBoard.length; i++) {
        GameBoard[i] = new Array(data.board.height).fill(0);
    }

    initializeSnakes();

    function initializeSnakes() {
        for (let snake of data.board.snakes) {
            GameBoard[snake.body[snake.body.length - 1].y][snake.body[snake.body.length - 1].x] = 2;

            for (let tile of snake.body) {
                if (tile == snake.body[0]) {
                    GameBoard[tile.y][tile.x] = 4;
                } else if (tile != snake.body[snake.body.length - 1]) {
                    GameBoard[tile.y][tile.x] = 3;
                }
            }


        }

        GameBoard[data.you.body[data.you.body.length - 1].y][data.you.body[data.you.body.length - 1].x] = 2;

        for (let tile of data.you.body) {
            if (tile == data.you.body[0]) {
                GameBoard[tile.y][tile.x] = 4;
            } else if (tile != data.you.body[data.you.body.length - 1]) {
                GameBoard[tile.y][tile.x] = 3;
            }
        }
    }

    initializeFoods();

    function initializeFoods() {
        for (let food of data.board.food) {
            GameBoard[food.y][food.x] = 1
        }
    }

    for (e of GameBoard) {
        console.log(e);
    }

    /*
     * get nearest piece of food as PrimalFood
    */

    let MinimumDistancedFood = Infinity;
    for (let food of data.board.food) {
        let distance = Math.abs(food.x - MySnakesHead.x) + Math.abs(food.y - MySnakesHead.y);
        if (distance < MinimumDistancedFood) {
            MinimumDistancedFood = distance;
            PrimalFood = food;
        }
    }

    /*
     * calculate remaining space as RemainingArea
    */

    let BoardArea = data.board.height * data.board.width;
    let RemainingArea = BoardArea;
    for (let snake of data.board.snakes) {
        RemainingArea -= snake.body.length
    }

    /*
     * test offsets if possible to play
    */

    for (let o = 0; o < 4; o++) {
        console.log(ObstacleOnPosition(offsets[o]));
        if (ObstacleOnPosition(offsets[o])) {
            chances[o] = 0;
        }
    }

    /*
     * get snakes and its lengths and configure chances on next movement if distance == 2
    */

    let snakes = [];
    for (snake of data.board.snakes) {

        /*
         * TODO:
         * edit chance changes
         * code design
        */

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

    /* 
     * influence of bordering fields
    */

    NextMoveInfluences();

    function NextMoveInfluences() {

        /*
         * TODO:
         * edit TunnelHasExit() function
         * change chances increasement
        */

        for (let i = 0; i < 4; i++) {
            difference = 0;
            for (let offset of offsets) {
                if (ObstacleOnPosition([offsets[i][0] + offset[0], offsets[i][1] + offset[1]]) && chances[i] > 0) {
                    difference += 10;
                }
            }
            if (difference >= 30 && chances[i] > 0) {
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
    }
    
    /*
     * Test for close room < 10 on neighbour fields
    */

    for (let d = 0; d < 4; d++) {
        let StartField = MySnakesHead;

        let TestField = getNeighbourField(StartField, d);
        let FreeFields = new Array();
        let i = 0;
        getAllFreeFields(TestField);

        console.log(FreeFields.length);

        if (i >= 10) {
            //increased chance for direction
        } else {    
            //decrease chance for direction proportional to FreeFields.length
            if (i == 0) {
                chances[d] == 0;
            } else {
                chances[d] -= parseInt(Math.pow(FreeFields.length, -1) * 80);
            }
            
            //test if there will be a exit in x moves
            //change chance for direction proportinal to chance for exit
        }

        function getAllFreeFields(field) {

            /*
             * TODO:
             * doubles
            */
    
            let FreeDirections = [];

            if (!ObstacleOnPosition([field.x, field.y])) {
                for (let direction = 0; direction < 4; direction++) {
    
                    let TestThisField = getNeighbourField(field, direction);
                    if (!ObstacleOnPosition([TestThisField.x, TestThisField.y])) {
                        if (!FieldInArray(TestThisField, FreeFields)) {
                            i++;
                            //FreeFields.push(f);
                            FreeDirections.push(direction);
                        }
                    }
                }
        
                for (let direction of FreeDirections) {
                    if (i <= 10) {
                        getAllFreeFields(getNeighbourField(field, direction));
                    }
                }
            }
    
        }
    }

    function FieldInArray(e, arr) {
        let FLAG = false;
        for (i of arr) {
            if (i.x == e.x && i.y == e.y) {
                FLAG = true;
            }
        }
        return FLAG;
    }

    function getNeighbourField(StartField, direction) {
        // direction : {left: 0, right: 1, up: 2, down: 3}
        let NeighbourField = {x: offsets[direction][0] + StartField.x, y: offsets[direction][1] + StartField.y};
        return NeighbourField;
    }

    /*
     * influence of food
    */

    FoodInfluences();

    function FoodInfluences() {

        /*
         * TODO:
         * if equal chances on different directions, then prefer food direction
         * if health decreased , then (proportional chance) turn to food direction
        */ 
        
        let OffsetToPrimalFood = [PrimalFood.x - MySnakesHead.x, PrimalFood.y - MySnakesHead.y];
        if (data.you.health <= 50) {
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

    /*
     * return move
    */

    let max = -Infinity;
    for (let i = 0; i < 4; i++) {
        if (chances[i] > max) {
            max = chances[i];
            nextMove = directions[i];
        }
    }

    for (let o = 0; o < 4; o++) {
        if (ObstacleOnPosition(offsets[o])) {
            chances[o] = 0;
        }
    }

    /*
     * logs
    */

    for (let i = 0; i < 4; i++) {
        console.log(chances[i]);
    }

    /*
     * Response data
    */
    
    const ResponseData = {
        move: nextMove, // one of: ['up','down','left','right']
    }

    return response.json(ResponseData);

    //teste von StartOffset alle Nachbarfelder ob frei
    //ignoriere bereits getestete Felder

    function TunnelHasExit (StartOffset) {
        return true;
        /*
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
        }*/
    }

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
        if (FLAG == false) {
            if (GameBoard[position.y][position.x] >= 3) {
                FLAG = true
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
  return response.json({});
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
