import _ from 'underscore';
import _Deep from 'underscore.deep'; 
_.mixin(_Deep);

/**
 * A callback for express routes. Permissions will be checked against req.user.
 * @param  {String|Array} permissions Permission node or nodes to test.
 * @param  {Function} [unauthorizedCallback] Callback to invoke for an unauthorized request.
 * @return {Function} A callback that express can use.
 */
export function needs(permissions, unauthorizedCallback){
    return function(req, res, next){
        if(typeof req.user !== 'undefined' && has(req.user.permissions, permissions)){
            next();
        }else{
            if(unauthorizedCallback){
                unauthorizedCallback(req, res, next);
            }else{
                res.status(403).send('Unauthorized');
            }
            
        }
    }
}

export function expand(permissionsArray){
    var permissions = {};

/*    if(typeof permObject.permissions === 'undefined'){
        permObject.permissions = [];rs
    }*/
    _.each(permissionsArray, function(nodeString){
        expandNode(permissions, nodeString);
    });
    permissions.__expanded = true

    return permissions;
};


export function expandNode(permHash, nodeString){
    var negated = false;

    var nodeArray = nodeString.split(".");
    var nodeArrayLength = nodeArray.length;
    var previousNode = permHash;
    _.each(nodeArray, function(node, index){
        if(previousNode[node] == undefined && node != "*"){
            var all = (node == "*")?true:false;
            previousNode[node] = {};
            if(index == nodeArrayLength-1){
                previousNode[node]._this = true;
            }
            if(all){
                previousNode[node]._all = true;
            }
        }else if(node == "*"){
            previousNode._all = true;
        }
        previousNode = previousNode[node];
    });
}


export function has(permissions, testNodeStrings){

    if(typeof permissions == 'undefined' || permissions == null || permissions === {}){
        return false
    }
    if(permissions.__expanded !== true){
        permissions = expand(permissions)
    }

    //normalize test into an array
    if(_.isArray(testNodeStrings) == false){
        testNodeStrings = [testNodeStrings];
    }

    var isPermitted = false;

    if(typeof permissions == 'undefined'){
        return true;
    }

    isPermitted = testNodeStrings.every(function(testNodeString){
        return testNode(permissions, testNodeString);
    });

    return isPermitted;
}


export function testNode(permissionsHash, testString){

    //console.log('testString', testString)

    var success = false;

    if(typeof testString == "undefined"){
        testString = '';
    }
    var testNodes = testString.split('.');

    //check for negated exact nodeString : ( -foo.bar )
    if(_.deepHas(permissionsHash, '-'+testString+'._this') === true){
        return false;
    }

    //check current exact nodeString : ( foo.bar )
    if( _.deepHas(permissionsHash, testString+'._this') === true){
        return true;
    }

    //check for root wildcard : ( * )
    if( _.deepHas(permissionsHash,'_all') === true){
        success = true;
    }

    //test wildcards
    var previousLevel = '';
    testNodes.every(function(key){
        var nodeString = (previousLevel === '')?''+key:previousLevel+'.'+key;

        //check for negated wildcard : ( -foo.bar.* )
        if(previousLevel != ''){ //must be at least 1 level deep
            if( _.deepHas(permissionsHash, '-'+nodeString+'._all') === true){
                success = false;
                return false;
            }
        }

        //check for wildcard : ( foo.bar.* )
        if( _.deepHas(permissionsHash, nodeString+'._all') === true){
            success = true;
            return false;
        }

        previousLevel = nodeString;

        return true;
        
    });

    return success;
}