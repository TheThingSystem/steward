# Actors
An *actor* refers to a prototype of a entity that participates in an activity. Typically, these refer to devices; however, there are two other types of actors: _groups_ which combine actors accordingly to a logical relationship (e.g., 'and' or 'first/next') and _pseudo actors_ which are software-only constructs (e.g., the *clipboard*).

## Architecture

## Design Patterns
#### Device actors
#### Group actors
#### Pseudo actors

## Pseudo actors
### Clipboard
### Place
_TODO:_ automatic reconfiguration when geolocation changes

## API calls

    /manage/api/v1/

        /actor/list[/prefix]     options.depth: { flat, tree, all }
        /actor/perform/prefix    perform, parameter
