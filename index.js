    
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

    let MySnakesHead = data.you.body[0];
    let MyLength = data.you.body.length;

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

    /*initializeFoods();

    function initializeFoods() {
        for (let food of data.board.food) {
            GameBoard[food.y][food.x] = 1
        }
    }*/

    let BoardArea = 0;
    let RemainingArea = 0;

    calculateRemainingArea();

    function calculateRemainingArea () {

        BoardArea = data.board.height * data.board.width;
        RemainingArea = BoardArea;
        for (let snake of data.board.snakes) {
            RemainingArea -= snake.body.length
        }
     
    }

    let PrimalFood;

    try {
        PrimalFood = data.board.food[0];
        getNearestPieceOfFoodAsPrimalFood();
    } catch (e) {
        PrimalFood = [NULL, NULL];
    }
    

    function getNearestPieceOfFoodAsPrimalFood () {

        let MinimumDistancedFood = Infinity;

        for (let food of data.board.food) {
            let distance = Math.abs(food.x - MySnakesHead.x) + Math.abs(food.y - MySnakesHead.y);
            if (distance < MinimumDistancedFood) {
                MinimumDistancedFood = distance;
                PrimalFood = food;
            }
        }

    }

    console.log("LOG: No. 1");

    if (PrimalFood[0] != NULL) {
        FoodInfluences();
    }

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

    console.log("LOG: No. 2");

    let FreeFieldInDirections = [0, 0, 0, 0];
    countFreeFieldsInDirections();

    function countFreeFieldsInDirections () {
        for (let d = 0; d < 4; d++) {

            let GoneDirections = [];
            let TestField = getNeighbourField(MySnakesHead, d);
    
            function getNeighbourField(StartField, direction) {
                // direction : {left: 0, right: 1, up: 2, down: 3}
                let NeighbourField = {x: offsets[direction][0] + StartField.x, y: offsets[direction][1] + StartField.y};
                return NeighbourField;
            }
    
            let FreeFields = [];
    
            let i = 0;
            getAllFreeFields(TestField);
    
            FreeFieldInDirections[d] = i;

            if (alwaysTheSame(GoneDirections)) {
                chances[d] -= 30;
            }

            function alwaysTheSame (array) {
                for (let k = 0; k < array.length - 1; k++) {
                    if (array[k] != array[k + 1]) {
                        return false;
                    }
                }
                return true;
            }
            
                
            //test if there will be a exit in x moves
            //change chance for direction proportinal to chance for exit
    
            function getAllFreeFields(field) {
        
                let FreeDirections = [];
    
                if (!ObstacleOnTile(field)) {
    
                    if (!FieldInArray(field, FreeFields)) {
                        i++;
                        FreeFields.push(field.x);
                        FreeFields.push(field.y);
                    }
    
                    for (let direction = 0; direction < 4; direction++) {
        
                        let TestThisField = getNeighbourField(field, direction);
                        if (!ObstacleOnTile(TestThisField)) {
                            if (!FieldInArray(TestThisField, FreeFields)) {
                                GoneDirections.push(direction);
                                i++;
                                FreeFields.push(TestThisField.x);
                                FreeFields.push(TestThisField.y);
                                FreeDirections.push(direction);
                            }
                        }
                    }
            
                    for (let direction of FreeDirections) {
                        if (i < RemainingArea) {
                            getAllFreeFields(getNeighbourField(field, direction));
                        }
                    }
                }
        
            }
        }

        function FieldInArray(element, array) {

            let FLAG = false;
    
            for (let i = 0; i < array.length; i += 2) {
                if (array[i] == element.x && array[i + 1] == element.y) {
                    FLAG = true;
                }
            }
    
            return FLAG;
    
        }
    }

    console.log("LOG: No. 3");

    /* TODO: Auswertung FreeFieldsInDirection */
    let MaxFreeFields = Math.max(...FreeFieldInDirections);
    let MinFreeFields = Math.min(...FreeFieldInDirections);

    let AvgFreeFields = 0;
    for (let element of FreeFieldInDirections) {
        AvgFreeFields += element / FreeFieldInDirections.length;
    }

    if (MaxFreeFields != MinFreeFields) {
        for (let d = 0; d < 4; d++) {
            if (FreeFieldInDirections[d] < MyLength) {
                chances[d] -= 100 * (AvgFreeFields - FreeFieldInDirections[d]) / AvgFreeFields;
            }
        }
    }

    console.log("LOG: No. 4");

    testForComingSnake();

    function testForComingSnake () {

        for (snake of data.board.snakes) {
    
            let snakehead = snake.body[0];

            let DistanceToMySnakeHead = Math.abs(snakehead.x - MySnakesHead.x) + Math.abs(snakehead.y - MySnakesHead.y);
            let SnakeLength = snake.body.length;
    
            let changeAmountChance = SnakeLength >= MyLength ? -50 : 20;
    
            if (DistanceToMySnakeHead == 2) {

                let OffsetToMySnakesHead = {x: snakehead.x - MySnakesHead.x, y: snakehead.y - MySnakesHead.y};

                if (OffsetToMySnakesHead.x < 0) {
                    chances[0] += changeAmountChance;
                } else if (OffsetToMySnakesHead.x > 0) {
                    chances[1] += changeAmountChance;
                }

                if (OffsetToMySnakesHead.y < 0) {
                    chances[2] += changeAmountChance;
                } else if (OffsetToMySnakesHead.y > 0) {
                    chances[3] += changeAmountChance;
                }

            } 
        }

    }

    let borderingFields = [0, 0, 0, 0]
    chancingToBorderingFields()

    function chancingToBorderingFields () {
        for (let i = 0; i < 4; i++) {
            borderingField = 0;
            for (let offset of offsets) {
                if (ObstacleOnOffset([offsets[i][0] + offset[0], offsets[i][1] + offset[1]]) && chances[i] > 0) {
                    borderingField += 1;
                }
            }
            
            borderingFields[i] = borderingField;
        }

        if (chances[0] == chances[1]) {
            if (borderingFields[0] > borderingFields[1]) {
                chances[0]--;
            } else if (borderingFields[0] < borderingFields[1]) {
                chances[0]++;
            }
        }
        if (chances[0] == chances[2]) {
            if (borderingFields[0] > borderingFields[2]) {
                chances[0]--;
            } else if (borderingFields[0] < borderingFields[2]) {
                chances[0]++;
            }
        }
        if (chances[0] == chances[3]) {
            if (borderingFields[0] > borderingFields[3]) {
                chances[0]--;
            } else if (borderingFields[0] < borderingFields[3]) {
                chances[0]++;
            }
        }
        if (chances[1] == chances[2]) {
            if (borderingFields[1] > borderingFields[2]) {
                chances[1]--;
            } else if (borderingFields[1] < borderingFields[2]) {
                chances[1]++;
            }
        }
        if (chances[1] == chances[3]) {
            if (borderingFields[1] > borderingFields[3]) {
                chances[1]--;
            } else if (borderingFields[1] < borderingFields[3]) {
                chances[1]++;
            }
        }
        if (chances[2] == chances[3]) {
            if (borderingFields[2] > borderingFields[3]) {
                chances[2]--;
            } else if (borderingFields[2] < borderingFields[3]) {
                chances[2]++;
            }
        }
    }

    console.log("LOG: No. 5");
    
    for (let o = 0; o < 4; o++) {
        if (ObstacleOnOffset(offsets[o])) {
            chances[o] = 0;
        }
    }

    function ObstacleOnOffset (offset) {

        let position = {x: 0, y: 0};

        position.x = MySnakesHead.x + offset[0];
        position.y = MySnakesHead.y + offset[1];

        return ObstacleOnTile(position);
        
    }

    function ObstacleOnTile (tile) {

        let FLAG = false;

        //test for border
        if (tile.x < 0 || tile.x > data.board.width - 1) {
            FLAG = true;
        }
        if (tile.y < 0 || tile.y > data.board.height - 1) {
            FLAG = true;
        }

        //test for snake
        if (FLAG == false) {
            if (GameBoard[tile.y][tile.x] > 2) {
                FLAG = true
            }
        }

        return FLAG;

    }

    function ObstacleOnOffsetOfOpponent (snake, offset) {

        let position = {x: 0, y: 0};

        position.x = snake.body[0].x + offset[0];
        position.y = snake.body[0].y + offset[1];

        return ObstacleOnTile(position);

    }

    /*
     * logs
    */

    for (let i = 0; i < 4; i++) {
        console.log(chances[i]);
    }

    max = -Infinity;
    for (let i = 0; i < 4; i++) {
        if (chances[i] > max) {
            max = chances[i];
            move = directions[i];
        }
    }

    const ResponseData = {
        move: move, // one of: ['up','down','left','right']
    }

    return response.json(ResponseData);

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