/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import type { PropsWithChildren } from 'react';
import type { RouteRef, BackstagePlugin } from '@backstage/core-plugin-api';

describe.each(['beta', 'stable'])('react-router %s', v => {
  beforeAll(() => {
    jest.doMock('react-router', () =>
      v === 'beta'
        ? jest.requireActual('react-router')
        : jest.requireActual('react-router-stable'),
    );
    jest.doMock('react-router-dom', () =>
      v === 'beta'
        ? jest.requireActual('react-router-dom')
        : jest.requireActual('react-router-dom-stable'),
    );
  });

  function requireDeps() {
    return {
      ...(require('./collectors') as typeof import('./collectors')),
      ...(require('../extensions/traversal') as typeof import('../extensions/traversal')),
      ...(require('@backstage/core-plugin-api') as typeof import('@backstage/core-plugin-api')),
      ...(require('react-router-dom') as typeof import('react-router-dom')),
    };
  }

  afterAll(() => {
    jest.resetModules();
    jest.resetAllMocks();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('does something', () => {
    const { Route } = requireDeps();
    console.log('DEBUG: Route =', Route);
  });

  const MockComponent = ({
    children,
  }: PropsWithChildren<{ path?: string }>) => <>{children}</>;

  const plugin = createPlugin({ id: 'my-plugin' });

  const ref1 = createRouteRef({ id: 'ref1' });
  const ref2 = createRouteRef({ id: 'ref2' });
  const ref3 = createRouteRef({ id: 'ref3' });
  const ref4 = createRouteRef({ id: 'ref4' });
  const ref5 = createRouteRef({ id: 'ref5' });
  const refOrder = [ref1, ref2, ref3, ref4, ref5];

  const Extension1 = plugin.provide(
    createRoutableExtension({
      name: 'Extension1',
      component: () => Promise.resolve(MockComponent),
      mountPoint: ref1,
    }),
  );
  const Extension2 = plugin.provide(
    createRoutableExtension({
      name: 'Extension2',
      component: () => Promise.resolve(MockComponent),
      mountPoint: ref2,
    }),
  );
  const Extension3 = plugin.provide(
    createRoutableExtension({
      name: 'Extension3',
      component: () => Promise.resolve(MockComponent),
      mountPoint: ref3,
    }),
  );
  const Extension4 = plugin.provide(
    createRoutableExtension({
      name: 'Extension4',
      component: () => Promise.resolve(MockComponent),
      mountPoint: ref4,
    }),
  );
  const Extension5 = plugin.provide(
    createRoutableExtension({
      name: 'Extension5',
      component: () => Promise.resolve(MockComponent),
      mountPoint: ref5,
    }),
  );

  const AggregationComponent = ({
    children,
  }: PropsWithChildren<{
    path: string;
  }>) => <>{children}</>;

  attachComponentData(AggregationComponent, 'core.gatherMountPoints', true);

  function sortedEntries<T>(map: Map<RouteRef, T>): [RouteRef, T][] {
    return Array.from(map).sort(
      ([a], [b]) => refOrder.indexOf(a) - refOrder.indexOf(b),
    );
  }

  function routeObj(
    path: string,
    refs: RouteRef[],
    children: any[] = [],
    type: 'mounted' | 'gathered' = 'mounted',
    backstagePlugin?: BackstagePlugin,
  ) {
    return {
      path: path,
      caseSensitive: false,
      element: type,
      routeRefs: new Set(refs),
      children: [
        {
          path: '*',
          caseSensitive: false,
          element: 'match-all',
          routeRefs: new Set(),
        },
        ...children,
      ],
      plugin: backstagePlugin,
    };
  }

  describe('routingV1Collector', () => {
    it('should collect routes', () => {
      const list = [
        <div key={0} />,
        <div key={1} />,
        <div key={3}>
          <Extension5 path="/blop" />
        </div>,
      ];

      const root = (
        <MemoryRouter>
          <Routes>
            <Extension1 path="/foo">
              <div>
                <Extension2 path="/bar/:id">
                  <div>
                    <div />
                    Some text here shouldn't be a problem
                    <div />
                    {null}
                    <div />
                    <Extension3 path="/baz" />
                  </div>
                </Extension2>
                {false}
                {list}
                {true}
                {0}
              </div>
            </Extension1>
            <div>
              <Route path="/divsoup" element={<Extension4 />} />
            </div>
          </Routes>
        </MemoryRouter>
      );

      const { routing } = traverseElementTree({
        root,
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV1Collector,
        },
      });
      expect(sortedEntries(routing.paths)).toEqual([
        [ref1, '/foo'],
        [ref2, '/bar/:id'],
        [ref3, '/baz'],
        [ref4, '/divsoup'],
        [ref5, '/blop'],
      ]);
      expect(sortedEntries(routing.parents)).toEqual([
        [ref1, undefined],
        [ref2, ref1],
        [ref3, ref2],
        [ref4, undefined],
        [ref5, ref1],
      ]);
      expect(routing.objects).toEqual([
        routeObj(
          '/foo',
          [ref1],
          [
            routeObj('/bar/:id', [ref2], [routeObj('/baz', [ref3])]),
            routeObj('/blop', [ref5]),
          ],
        ),
        routeObj('/divsoup', [ref4], undefined, undefined, plugin),
      ]);
    });

    it('should handle all react router Route patterns', () => {
      const root = (
        <MemoryRouter>
          <Routes>
            <Route
              path="/foo"
              element={
                <Extension1>
                  <Routes>
                    <Extension2 path="/bar/:id" />
                  </Routes>
                </Extension1>
              }
            />
            <Route path="/baz" element={<Extension3 path="/not-used" />}>
              <Route path="/divsoup" element={<Extension4 />} />
              <Extension5 path="/blop" />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      const { routing } = traverseElementTree({
        root,
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV1Collector,
        },
      });
      expect(sortedEntries(routing.paths)).toEqual([
        [ref1, '/foo'],
        [ref2, '/bar/:id'],
        [ref3, '/baz'],
        [ref4, '/divsoup'],
        [ref5, '/blop'],
      ]);
      expect(sortedEntries(routing.parents)).toEqual([
        [ref1, undefined],
        [ref2, ref1],
        [ref3, undefined],
        [ref4, ref3],
        [ref5, ref3],
      ]);
    });

    it('should use the route aggregator key to bind child routes to the same path', () => {
      const root = (
        <MemoryRouter>
          <Routes>
            <AggregationComponent path="/foo">
              <Extension1 />
              <div>
                <Extension2 />
              </div>
              HELLO
            </AggregationComponent>
            <Extension3 path="/bar">
              <AggregationComponent path="/baz">
                <Extension4>
                  <Extension5 />
                </Extension4>
              </AggregationComponent>
            </Extension3>
          </Routes>
        </MemoryRouter>
      );

      const { routing } = traverseElementTree({
        root,
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV1Collector,
        },
      });
      expect(sortedEntries(routing.paths)).toEqual([
        [ref1, '/foo'],
        [ref2, '/foo'],
        [ref3, '/bar'],
        [ref4, '/baz'],
        [ref5, '/baz'],
      ]);
      expect(sortedEntries(routing.parents)).toEqual([
        [ref1, undefined],
        [ref2, undefined],
        [ref3, undefined],
        [ref4, ref3],
        [ref5, ref3],
      ]);
      expect(routing.objects).toEqual([
        routeObj('/foo', [ref1, ref2], [], 'gathered'),
        routeObj(
          '/bar',
          [ref3],
          [routeObj('/baz', [ref4, ref5], [], 'gathered')],
        ),
      ]);
    });

    it('should use the route aggregator but stop when encountering explicit path', () => {
      const root = (
        <MemoryRouter>
          <Routes>
            <Extension1 path="/foo">
              <AggregationComponent path="/bar">
                <Extension2>
                  <Extension3 path="/baz">
                    <Extension4 path="/blop" />
                  </Extension3>
                  <Extension5 />
                </Extension2>
              </AggregationComponent>
            </Extension1>
          </Routes>
        </MemoryRouter>
      );

      const { routing } = traverseElementTree({
        root,
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV1Collector,
        },
      });
      expect(sortedEntries(routing.paths)).toEqual([
        [ref1, '/foo'],
        [ref2, '/bar'],
        [ref3, '/baz'],
        [ref4, '/blop'],
        [ref5, '/bar'],
      ]);
      expect(sortedEntries(routing.parents)).toEqual([
        [ref1, undefined],
        [ref2, ref1],
        [ref3, ref1],
        [ref4, ref3],
        [ref5, ref1],
      ]);
      expect(routing.objects).toEqual([
        routeObj(
          '/foo',
          [ref1],
          [
            routeObj(
              '/bar',
              [ref2, ref5],
              [routeObj('/baz', [ref3], [routeObj('/blop', [ref4])])],
              'gathered',
            ),
          ],
        ),
      ]);
    });

    it('should stop gathering mount points after encountering explicit path', () => {
      const root = (
        <MemoryRouter>
          <Routes>
            <Extension1 path="/foo">
              <AggregationComponent path="/bar">
                <Extension2 path="/baz">
                  <Extension3 />
                </Extension2>
              </AggregationComponent>
            </Extension1>
          </Routes>
        </MemoryRouter>
      );

      expect(() => {
        traverseElementTree({
          root,
          discoverers: [childDiscoverer, routeElementDiscoverer],
          collectors: {
            routing: routingV1Collector,
          },
        });
      }).toThrow('Mounted routable extension must have a path');
    });
  });

  describe('routingV2Collector', () => {
    function routeRoot(element: JSX.Element) {
      return (
        <MemoryRouter>
          <Routes>{element}</Routes>
        </MemoryRouter>
      );
    }

    it('should associate path with extension in element prop', () => {
      const { routing } = traverseElementTree({
        root: routeRoot(<Route path="/foo" element={<Extension1 />} />),
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV2Collector,
        },
      });

      expect(sortedEntries(routing.paths)).toEqual([[ref1, '/foo']]);
      expect(sortedEntries(routing.parents)).toEqual([[ref1, undefined]]);
      expect(routing.objects).toEqual([
        routeObj('/foo', [ref1], [], undefined, plugin),
      ]);
    });

    it('should not allow multiple extensions within the same element prop', () => {
      expect(() =>
        traverseElementTree({
          root: routeRoot(
            <Route
              path="/foo"
              element={
                <>
                  <Extension1 />
                  <Extension2 />
                </>
              }
            />,
          ),
          discoverers: [childDiscoverer, routeElementDiscoverer],
          collectors: {
            routing: routingV2Collector,
          },
        }),
      ).toThrow('Route element may not contain multiple routable extensions');
    });

    it('should not support inline path', () => {
      expect(() =>
        traverseElementTree({
          root: routeRoot(<Extension1 path="/foo" />),
          discoverers: [childDiscoverer, routeElementDiscoverer],
          collectors: {
            routing: routingV2Collector,
          },
        }),
      ).toThrow(
        'Path property may not be set directly on a routable extension',
      );
    });

    it('should associate the path with extensions deep in the element prop', () => {
      const { routing } = traverseElementTree({
        root: routeRoot(
          <Route
            path="/foo"
            element={
              <>
                <div>
                  <span />
                  {[
                    undefined,
                    null,
                    <main>
                      <Extension1 />
                    </main>,
                  ]}
                </div>
              </>
            }
          />,
        ),
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV2Collector,
        },
      });

      expect(sortedEntries(routing.paths)).toEqual([[ref1, '/foo']]);
      expect(sortedEntries(routing.parents)).toEqual([[ref1, undefined]]);
      expect(routing.objects).toEqual([
        routeObj('/foo', [ref1], [], undefined, plugin),
      ]);
    });

    it('should not associate path with extension in children prop', () => {
      expect(() =>
        traverseElementTree({
          root: routeRoot(
            <Route path="/foo">
              <Extension1 />
            </Route>,
          ),
          discoverers: [childDiscoverer, routeElementDiscoverer],
          collectors: {
            routing: routingV2Collector,
          },
        }),
      ).toThrow('Routable extension must be assigned a path');
    });

    it('should assign parent for extension in element prop', () => {
      const { routing } = traverseElementTree({
        root: routeRoot(
          <Route path="/foo" element={<Extension1 />}>
            <Route path="/bar" element={<Extension2 />} />
          </Route>,
        ),
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV2Collector,
        },
      });

      expect(sortedEntries(routing.paths)).toEqual([
        [ref1, '/foo'],
        [ref2, '/bar'],
      ]);
      expect(sortedEntries(routing.parents)).toEqual([
        [ref1, undefined],
        [ref2, ref1],
      ]);
      expect(routing.objects).toEqual([
        routeObj(
          '/foo',
          [ref1],
          [routeObj('/bar', [ref2], [], undefined, plugin)],
          undefined,
          plugin,
        ),
      ]);
    });

    it('should not allow paths within element props', () => {
      expect(() => {
        traverseElementTree({
          root: routeRoot(
            <Route
              path="."
              element={<Route path="/foo" element={<Extension1 />} />}
            />,
          ),
          discoverers: [childDiscoverer, routeElementDiscoverer],
          collectors: {
            routing: routingV2Collector,
          },
        });
      }).toThrow('Elements within the element prop tree may not contain paths');
    });

    it('should not allow extensions within the element prop to have path props either', () => {
      expect(() => {
        traverseElementTree({
          root: routeRoot(
            <Route path="." element={<Extension1 path="/foo" />} />,
          ),
          discoverers: [childDiscoverer, routeElementDiscoverer],
          collectors: {
            routing: routingV2Collector,
          },
        });
      }).toThrow('Elements within the element prop tree may not contain paths');
    });

    it('should gather extension', () => {
      const { routing } = traverseElementTree({
        root: routeRoot(
          <AggregationComponent path="/foo">
            <Extension1 />
          </AggregationComponent>,
        ),
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV2Collector,
        },
      });

      expect(sortedEntries(routing.paths)).toEqual([[ref1, '/foo']]);
      expect(sortedEntries(routing.parents)).toEqual([[ref1, undefined]]);
      expect(routing.objects).toEqual([
        routeObj('/foo', [ref1], [], 'gathered'),
      ]);
    });

    it('should reset gathering if path prop is encountered', () => {
      const { routing } = traverseElementTree({
        root: routeRoot(
          <AggregationComponent path="/foo">
            <Extension1>
              <Route path="/bar" element={<Extension2 />} />
            </Extension1>
          </AggregationComponent>,
        ),
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV2Collector,
        },
      });

      expect(sortedEntries(routing.paths)).toEqual([
        [ref1, '/foo'],
        [ref2, '/bar'],
      ]);
      expect(sortedEntries(routing.parents)).toEqual([
        [ref1, undefined],
        [ref2, ref1],
      ]);
      expect(routing.objects).toEqual([
        routeObj(
          '/foo',
          [ref1],
          [routeObj('/bar', [ref2], [], undefined, plugin)],
          'gathered',
        ),
      ]);
    });

    it('should collect routes defined with different patterns', () => {
      const list = [
        <div key={0} />,
        <div key={1} />,
        <div key={3}>
          <Route path="/blop" element={<Extension5 />} />
        </div>,
      ];

      const { routing } = traverseElementTree({
        root: routeRoot(
          <>
            <Route path="/foo" element={<Extension1 />}>
              <div>
                <Route path="/bar/:id" element={<Extension2 />}>
                  <div>
                    <div />
                    Some text here shouldn't be a problem
                    <div />
                    {null}
                    <div />
                    <Route path="/baz" element={<Extension3 />} />
                  </div>
                </Route>
                {false}
                {list}
                {true}
                {0}
              </div>
            </Route>
            <div>
              <Route path="/divsoup" element={<Extension4 />} />
            </div>
          </>,
        ),
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV2Collector,
        },
      });
      expect(sortedEntries(routing.paths)).toEqual([
        [ref1, '/foo'],
        [ref2, '/bar/:id'],
        [ref3, '/baz'],
        [ref4, '/divsoup'],
        [ref5, '/blop'],
      ]);
      expect(sortedEntries(routing.parents)).toEqual([
        [ref1, undefined],
        [ref2, ref1],
        [ref3, ref2],
        [ref4, undefined],
        [ref5, ref1],
      ]);
      expect(routing.objects).toEqual([
        routeObj(
          '/foo',
          [ref1],
          [
            routeObj(
              '/bar/:id',
              [ref2],
              [routeObj('/baz', [ref3], [], undefined, plugin)],
              undefined,
              plugin,
            ),
            routeObj('/blop', [ref5], [], undefined, plugin),
          ],
          undefined,
          plugin,
        ),
        routeObj('/divsoup', [ref4], undefined, undefined, plugin),
      ]);
    });

    it('should handle a subset of react router Route patterns', () => {
      const { routing } = traverseElementTree({
        root: routeRoot(
          <>
            <Route path="/foo" element={<Extension1 />} />
            <Route
              path="/baz"
              element={
                <div>
                  <Extension2 />
                </div>
              }
            >
              <Route path="/child" element={<Extension3 />} />
              <AggregationComponent path="/collected">
                <Extension4 />
              </AggregationComponent>
            </Route>
          </>,
        ),
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV2Collector,
        },
      });
      expect(sortedEntries(routing.paths)).toEqual([
        [ref1, '/foo'],
        [ref2, '/baz'],
        [ref3, '/child'],
        [ref4, '/collected'],
      ]);
      expect(sortedEntries(routing.parents)).toEqual([
        [ref1, undefined],
        [ref2, undefined],
        [ref3, ref2],
        [ref4, ref2],
      ]);
    });

    it('should bind child routes to the same path with a gatherer flag', () => {
      const { routing } = traverseElementTree({
        root: routeRoot(
          <>
            <AggregationComponent path="/foo">
              <Extension1 />
              <div>
                <Extension2 />
              </div>
              HELLO
            </AggregationComponent>
          </>,
        ),
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV2Collector,
        },
      });
      expect(sortedEntries(routing.paths)).toEqual([
        [ref1, '/foo'],
        [ref2, '/foo'],
      ]);
      expect(sortedEntries(routing.parents)).toEqual([
        [ref1, undefined],
        [ref2, undefined],
      ]);
      expect(routing.objects).toEqual([
        routeObj('/foo', [ref1, ref2], [], 'gathered'),
      ]);
    });

    it('should gather routes but stop when encountering explicit path', () => {
      const { routing } = traverseElementTree({
        root: routeRoot(
          <Route path="/foo" element={<Extension1 />}>
            <AggregationComponent path="/bar">
              <Extension2>
                <Route path="/baz" element={<Extension3 />}>
                  <AggregationComponent path="/blop">
                    <Extension4 />
                  </AggregationComponent>
                </Route>
                <Extension5 />
              </Extension2>
            </AggregationComponent>
          </Route>,
        ),
        discoverers: [childDiscoverer, routeElementDiscoverer],
        collectors: {
          routing: routingV2Collector,
        },
      });
      expect(sortedEntries(routing.paths)).toEqual([
        [ref1, '/foo'],
        [ref2, '/bar'],
        [ref3, '/baz'],
        [ref4, '/blop'],
        [ref5, '/bar'],
      ]);
      expect(sortedEntries(routing.parents)).toEqual([
        [ref1, undefined],
        [ref2, ref1],
        [ref3, ref2],
        [ref4, ref3],
        [ref5, ref1],
      ]);
      expect(routing.objects).toEqual([
        routeObj(
          '/foo',
          [ref1],
          [
            routeObj(
              '/bar',
              [ref2, ref5],
              [
                routeObj(
                  '/baz',
                  [ref3],
                  [routeObj('/blop', [ref4], [], 'gathered')],
                  undefined,
                  plugin,
                ),
              ],
              'gathered',
            ),
          ],
          undefined,
          plugin,
        ),
      ]);
    });
  });
});
