# Map Schema V5

The map format is now a fixed application contract.

## Required top-level fields

- `version`: `5`
- `id`: string
- `name`: string
- `size.width`, `size.length`: meters
- `tileSize`: meters
- `grid.cols`, `grid.rows`
- `tileTypes`
- `tiles`: exactly `cols * rows` entries
- `obstacles`
- `spawn.x`, `spawn.y`, `spawn.z`, `spawn.yaw`
- `createdAt`, `updatedAt`

## Tile

```json
{"type":"asphalt","height":0}
```

`type` must exist in `tileTypes`. Height is meters.

## Obstacles

Fence:
```json
{"type":"fence","x":0,"z":0,"yaw":0,"scale":1}
```

L-corner fence:
```json
{"type":"fenceCorner","corner":"nw","x":0,"z":0,"yaw":0,"scale":1}
```

`corner` is one of `nw`, `ne`, `sw`, `se`.

Tree:
```json
{"type":"tree","x":0,"z":0,"yaw":0,"scale":1}
```

## Compatibility

`normalizeMap()` accepts older V4 and incomplete maps and fills missing/default fields.
`MapStorage` normalizes and validates every map at the persistence boundary.

This makes `MapStorage` replaceable with a server API later without changing the map
editor's data model.
