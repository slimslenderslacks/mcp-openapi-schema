#!/usr/bin/env node
import SwaggerParser from "@apidevtools/swagger-parser";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import yaml from "js-yaml";
import { Console } from "node:console";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// Redirect console output to stderr to avoid interfering with MCP comms
globalThis.console = new Console(process.stderr);

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
OpenAPI Schema Model Context Protocol Server

Usage: 
  node index.mjs [path/to/openapi.yaml]

Arguments:
  path/to/openapi.yaml  Path to the OpenAPI schema file (JSON or YAML) (optional)
                       If not provided, defaults to openapi.yaml

Examples:
  node index.mjs # Uses default openapi.yaml
  node index.mjs ../petstore.json # Uses petstore OpenAPI spec
  node index.mjs /absolute/path/to/api-schema.yaml
  `);
  process.exit(0);
}

const loadSchema = (path) => {
  // Default to openapi.yaml if no argument provided
  const schemaPath = resolve(path);

  try {
    // Read and parse the file synchronously
    const fileContent = readFileSync(schemaPath, 'utf8');
    const parsedContent = yaml.load(fileContent);
    return parsedContent;
  } catch (error) {
    console.error(`Error loading schema: ${error.message}`);
    process.exit(1);
  }
};

const server = new McpServer({
  name: `OpenAPI Schema`,
  version: "1.0.0",
  description: `Provides OpenAPI schema information for schema files`,
});

// Helper to convert objects to YAML for better readability
const toYaml = (obj) => yaml.dump(obj, { lineWidth: 100, noRefs: true });

// List all API paths and operations
server.tool(
  "list-endpoints",
  "Lists all API paths and their HTTP methods with summaries, organized by path",
  { openapiSchemaPath: z.string().describe("Path to the OpenAPI schema file") },
  ({ openapiSchemaPath }) => {
    const openApiDoc = loadSchema(openapiSchemaPath);
    const pathMap = {};

    for (const [path, pathItem] of Object.entries(openApiDoc.paths || {})) {
      // Get all HTTP methods for this path
      const methods = Object.keys(pathItem).filter((key) =>
        ["get", "post", "put", "delete", "patch", "options", "head"].includes(key.toLowerCase()),
      );

      // Create a methods object for this path
      pathMap[path] = {};

      // Add each method with its summary
      for (const method of methods) {
        const operation = pathItem[method];
        pathMap[path][method.toUpperCase()] = operation.summary || "No summary";
      }
    }

    return {
      content: [
        {
          type: "text",
          text: toYaml(pathMap),
        },
      ],
    };
  },
);

// Get details for a specific endpoint
server.tool(
  "get-endpoint",
  "Gets detailed information about a specific API endpoint",
  {
    openapiSchemaPath: z.string().describe("Path to the OpenAPI schema file"),
    path: z.string(),
    method: z.string()
  },
  ({ openapiSchemaPath, path, method }) => {
    const openApiDoc = loadSchema(openapiSchemaPath);
    const pathItem = openApiDoc.paths?.[path];
    if (!pathItem) {
      return { content: [{ type: "text", text: `Path ${path} not found` }] };
    }

    const operation = pathItem[method.toLowerCase()];
    if (!operation) {
      return { content: [{ type: "text", text: `Method ${method} not found for path ${path}` }] };
    }

    // Extract relevant information
    const endpoint = {
      path,
      method: method.toUpperCase(),
      summary: operation.summary,
      description: operation.description,
      tags: operation.tags,
      parameters: operation.parameters,
      requestBody: operation.requestBody,
      responses: operation.responses,
      security: operation.security,
      deprecated: operation.deprecated,
    };

    return {
      content: [
        {
          type: "text",
          text: toYaml(endpoint),
        },
      ],
    };
  },
);

// Get request body schema for a specific endpoint
server.tool(
  "get-request-body",
  "Gets the request body schema for a specific endpoint",
  {
    openapiSchemaPath: z.string().describe("Path to the OpenAPI schema file"),
    path: z.string(),
    method: z.string()
  },
  ({ openapiSchemaPath, path, method }) => {
    const openApiDoc = loadSchema(openapiSchemaPath);
    const pathItem = openApiDoc.paths?.[path];
    if (!pathItem) {
      return { content: [{ type: "text", text: `Path ${path} not found` }] };
    }

    const operation = pathItem[method.toLowerCase()];
    if (!operation) {
      return { content: [{ type: "text", text: `Method ${method} not found for path ${path}` }] };
    }

    const requestBody = operation.requestBody;
    if (!requestBody) {
      return { content: [{ type: "text", text: `No request body defined for ${method} ${path}` }] };
    }

    return {
      content: [
        {
          type: "text",
          text: toYaml(requestBody),
        },
      ],
    };
  },
);

// Get response schema for a specific endpoint and status code
server.tool(
  "get-response-schema",
  "Gets the response schema for a specific endpoint, method, and status code",
  {
    openapiSchemaPath: z.string().describe("Path to the OpenAPI schema file"),
    path: z.string(),
    method: z.string(),
    statusCode: z.string().default("200"),
  },
  ({ openapiSchemaPath, path, method, statusCode }) => {
    const openApiDoc = loadSchema(openapiSchemaPath);
    const pathItem = openApiDoc.paths?.[path];
    if (!pathItem) {
      return { content: [{ type: "text", text: `Path ${path} not found` }] };
    }

    const operation = pathItem[method.toLowerCase()];
    if (!operation) {
      return { content: [{ type: "text", text: `Method ${method} not found for path ${path}` }] };
    }

    const responses = operation.responses;
    if (!responses) {
      return { content: [{ type: "text", text: `No responses defined for ${method} ${path}` }] };
    }

    const response = responses[statusCode] || responses.default;
    if (!response) {
      return {
        content: [
          {
            type: "text",
            text: `No response for status code ${statusCode} (or default) found for ${method} ${path}.\nAvailable status codes: ${Object.keys(responses).join(", ")}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: toYaml(response),
        },
      ],
    };
  },
);

// Get parameters for a specific path
server.tool(
  "get-path-parameters",
  "Gets the parameters for a specific path",
  {
    openapiSchemaPath: z.string().describe("Path to the OpenAPI schema file"),
    path: z.string(),
    method: z.string().optional()
  },
  ({ openapiSchemaPath, path, method }) => {
    const openApiDoc = loadSchema(openapiSchemaPath);
    const pathItem = openApiDoc.paths?.[path];
    if (!pathItem) {
      return { content: [{ type: "text", text: `Path ${path} not found` }] };
    }

    let parameters = [...(pathItem.parameters || [])];

    // If method is specified, add method-specific parameters
    if (method) {
      const operation = pathItem[method.toLowerCase()];
      if (operation && operation.parameters) {
        parameters = [...parameters, ...operation.parameters];
      }
    }

    if (parameters.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No parameters found for ${method ? `${method.toUpperCase()} ` : ""}${path}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: toYaml(parameters),
        },
      ],
    };
  },
);

// List all components
server.tool(
  "list-components",
  "Lists all schema components (schemas, parameters, responses, etc.)",
  { openapiSchemaPath: z.string().describe("Path to the OpenAPI schema file") },
  ({ openapiSchemaPath }) => {
    const openApiDoc = loadSchema(openapiSchemaPath);
    const components = openApiDoc.components || {};
    const result = {};

    // For each component type, list the keys
    for (const [type, items] of Object.entries(components)) {
      if (items && typeof items === "object") {
        result[type] = Object.keys(items);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: toYaml(result),
        },
      ],
    };
  },
);

// Get a specific component
server.tool(
  "get-component",
  "Gets detailed definition for a specific component",
  {
    openapiSchemaPath: z.string().describe("Path to the OpenAPI schema file"),
    type: z.string().describe("Component type (e.g., schemas, parameters, responses)"),
    name: z.string().describe("Component name"),
  },
  ({ openapiSchemaPath, type, name }) => {
    const openApiDoc = loadSchema(openapiSchemaPath);
    const components = openApiDoc.components || {};
    const componentType = components[type];

    if (!componentType) {
      return {
        content: [
          {
            type: "text",
            text: `Component type '${type}' not found. Available types: ${Object.keys(components).join(", ")}`,
          },
        ],
      };
    }

    const component = componentType[name];
    if (!component) {
      return {
        content: [
          {
            type: "text",
            text: `Component '${name}' not found in '${type}'. Available components: ${Object.keys(componentType).join(", ")}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: toYaml(component),
        },
      ],
    };
  },
);

// List security schemes
server.tool(
  "list-security-schemes",
  "Lists all available security schemes",
  { openapiSchemaPath: z.string().describe("Path to the OpenAPI schema file") },
  ({ openapiSchemaPath }) => {
    const openApiDoc = loadSchema(openapiSchemaPath);
    const securitySchemes = openApiDoc.components?.securitySchemes || {};
    const result = {};

    for (const [name, scheme] of Object.entries(securitySchemes)) {
      result[name] = {
        type: scheme.type,
        description: scheme.description,
        ...(scheme.type === "oauth2" ? { flows: Object.keys(scheme.flows || {}) } : {}),
        ...(scheme.type === "apiKey" ? { in: scheme.in, name: scheme.name } : {}),
        ...(scheme.type === "http" ? { scheme: scheme.scheme } : {}),
      };
    }

    if (Object.keys(result).length === 0) {
      return { content: [{ type: "text", text: "No security schemes defined in this API" }] };
    }

    return {
      content: [
        {
          type: "text",
          text: toYaml(result),
        },
      ],
    };
  },
);

// Get examples
server.tool(
  "get-examples",
  "Gets examples for a specific component or endpoint",
  {
    openapiSchemaPath: z.string().describe("Path to the OpenAPI schema file"),
    type: z.enum(["request", "response", "component"]).describe("Type of example to retrieve"),
    path: z.string().optional().describe("API path (required for request/response examples)"),
    method: z.string().optional().describe("HTTP method (required for request/response examples)"),
    statusCode: z.string().optional().describe("Status code (for response examples)"),
    componentType: z
      .string()
      .optional()
      .describe("Component type (required for component examples)"),
    componentName: z
      .string()
      .optional()
      .describe("Component name (required for component examples)"),
  },
  ({ openapiSchemaPath, type, path, method, statusCode, componentType, componentName }) => {
    const openApiDoc = loadSchema(openapiSchemaPath);
    if (type === "request") {
      if (!path || !method) {
        return {
          content: [{ type: "text", text: "Path and method are required for request examples" }],
        };
      }

      const operation = openApiDoc.paths?.[path]?.[method.toLowerCase()];
      if (!operation) {
        return {
          content: [{ type: "text", text: `Operation ${method.toUpperCase()} ${path} not found` }],
        };
      }

      if (!operation.requestBody?.content) {
        return {
          content: [
            { type: "text", text: `No request body defined for ${method.toUpperCase()} ${path}` },
          ],
        };
      }

      const examples = {};
      for (const [contentType, content] of Object.entries(operation.requestBody.content)) {
        if (content.examples) {
          examples[contentType] = content.examples;
        } else if (content.example) {
          examples[contentType] = { default: { value: content.example } };
        }
      }

      if (Object.keys(examples).length === 0) {
        return {
          content: [
            { type: "text", text: `No examples found for ${method.toUpperCase()} ${path} request` },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: toYaml(examples),
          },
        ],
      };
    } else if (type === "response") {
      if (!path || !method) {
        return {
          content: [{ type: "text", text: "Path and method are required for response examples" }],
        };
      }

      const operation = openApiDoc.paths?.[path]?.[method.toLowerCase()];
      if (!operation) {
        return {
          content: [{ type: "text", text: `Operation ${method.toUpperCase()} ${path} not found` }],
        };
      }

      if (!operation.responses) {
        return {
          content: [
            { type: "text", text: `No responses defined for ${method.toUpperCase()} ${path}` },
          ],
        };
      }

      const responseObj = statusCode
        ? operation.responses[statusCode]
        : Object.values(operation.responses)[0];
      if (!responseObj) {
        return {
          content: [
            {
              type: "text",
              text: `Response ${statusCode} not found for ${method.toUpperCase()} ${path}. Available: ${Object.keys(operation.responses).join(", ")}`,
            },
          ],
        };
      }

      if (!responseObj.content) {
        return { content: [{ type: "text", text: `No content defined in response` }] };
      }

      const examples = {};
      for (const [contentType, content] of Object.entries(responseObj.content)) {
        if (content.examples) {
          examples[contentType] = content.examples;
        } else if (content.example) {
          examples[contentType] = { default: { value: content.example } };
        }
      }

      if (Object.keys(examples).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No examples found for ${method.toUpperCase()} ${path} response${statusCode ? ` ${statusCode}` : ""}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: toYaml(examples),
          },
        ],
      };
    } else if (type === "component") {
      if (!componentType || !componentName) {
        return {
          content: [
            { type: "text", text: "Component type and name are required for component examples" },
          ],
        };
      }

      const component = openApiDoc.components?.[componentType]?.[componentName];
      if (!component) {
        return {
          content: [
            { type: "text", text: `Component ${componentType}.${componentName} not found` },
          ],
        };
      }

      const examples =
        component.examples || (component.example ? { default: component.example } : null);
      if (!examples) {
        return {
          content: [
            {
              type: "text",
              text: `No examples found for component ${componentType}.${componentName}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: toYaml(examples),
          },
        ],
      };
    }
  },
);

// Search across the API specification
server.tool(
  "search-schema",
  "Searches across paths, operations, and schemas",
  {
    openapiSchemaPath: z.string().describe("Path to the OpenAPI schema file"),
    pattern: z.string().describe("Search pattern (case-insensitive)")
  },
  ({ openapiSchemaPath, pattern }) => {
    const openApiDoc = loadSchema(openapiSchemaPath);
    const searchRegex = new RegExp(pattern, "i");
    const results = {
      paths: [],
      operations: [],
      components: [],
      parameters: [],
      securitySchemes: [],
    };

    // Search paths
    for (const path of Object.keys(openApiDoc.paths || {})) {
      if (searchRegex.test(path)) {
        results.paths.push(path);
      }

      // Search operations within paths
      const pathItem = openApiDoc.paths[path];
      for (const method of ["get", "post", "put", "delete", "patch", "options", "head"]) {
        const operation = pathItem[method];
        if (!operation) continue;

        if (
          searchRegex.test(operation.summary || "") ||
          searchRegex.test(operation.description || "") ||
          (operation.tags && operation.tags.some((tag) => searchRegex.test(tag)))
        ) {
          results.operations.push(`${method.toUpperCase()} ${path}`);
        }

        // Search parameters
        for (const param of operation.parameters || []) {
          if (searchRegex.test(param.name || "") || searchRegex.test(param.description || "")) {
            results.parameters.push(`${param.name} (${method.toUpperCase()} ${path})`);
          }
        }
      }
    }

    // Search components
    const components = openApiDoc.components || {};
    for (const [type, typeObj] of Object.entries(components)) {
      if (!typeObj || typeof typeObj !== "object") continue;

      for (const [name, component] of Object.entries(typeObj)) {
        if (searchRegex.test(name) || searchRegex.test(component.description || "")) {
          results.components.push(`${type}.${name}`);
        }
      }
    }

    // Search security schemes
    for (const [name, scheme] of Object.entries(components.securitySchemes || {})) {
      if (searchRegex.test(name) || searchRegex.test(scheme.description || "")) {
        results.securitySchemes.push(name);
      }
    }

    // Clean up empty arrays
    for (const key of Object.keys(results)) {
      if (results[key].length === 0) {
        delete results[key];
      }
    }

    if (Object.keys(results).length === 0) {
      return { content: [{ type: "text", text: `No matches found for "${pattern}"` }] };
    }

    return {
      content: [
        {
          type: "text",
          text: toYaml(results),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
