import path, { basename, join } from 'path';
import { expect } from 'esmocha';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

import { skipPrettierHelpers as helpers } from '../../test/support/helpers.mjs';
import { SERVER_MAIN_RES_DIR } from '../generator-constants.mjs';
import jdlImporter from '../../jdl/index.mjs';

const { createImporterFromContent } = jdlImporter;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const incrementalFiles = [
  `${SERVER_MAIN_RES_DIR}config/liquibase/master.xml`,
  `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/00000000000000_initial_schema.xml`,
];

const baseName = 'JhipsterApp';

const jdlApplication = `
application {
    config { baseName ${baseName} }
    entities *
}`;

const jdlApplicationWithEntities = `
${jdlApplication}
entity One {
    @Id oneId Long
    original String
}
entity Another {
    @Id anotherId Long
    original String
}`;

const jdlApplicationWithRelationshipToUser = `
${jdlApplicationWithEntities}
relationship ManyToOne {
    One{user(login)} to User with builtInEntity
}
`;

const jdlApplicationEntitieWithByteTypes = `
${jdlApplication}
entity Smarty {
  name String required unique minlength(2) maxlength(10)
  price Float required min(0)
  description TextBlob required
  picture ImageBlob required
  specification Blob
  category ProductCategory
  inventory Integer required min(0)
}
enum ProductCategory {
  Laptop, Desktop, Phone, Tablet, Accessory
}`;

const jdlApplicationEntitieWithoutByteTypes = `
${jdlApplication}
entity Smarty {
  name String
  age Integer
  height Long
  income BigDecimal
  expense Double
  savings Float
  category ProductCategory
  happy Boolean
  dob LocalDate
  exactTime ZonedDateTime
  travelTime Duration
  moment Instant
}
enum ProductCategory {
  Laptop, Desktop, Phone, Tablet, Accessory
}`;

const jdlApplicationWithEntitiesAndRelationship = `
${jdlApplicationWithEntities}
relationship OneToOne {
One to Another,
}`;

const jdlApplicationWithEntitiesAndRelationshipsWithOnHandlers = `
${jdlApplicationWithEntities}
relationship ManyToOne {
One to @OnDelete("CASCADE") @OnUpdate("SET NULL") Another,
}`;

const jdlApplicationWithEntitiesAndRelationshipsWithChangedOnHandlers = `
${jdlApplicationWithEntities}
relationship ManyToOne {
One to @OnDelete("SET NULL") @OnUpdate("CASCADE") Another,
}`;

const jdlApplicationWithEntitiesAndRelationshipsWithChangedOnHandlersAndChangedNaming = `
${jdlApplicationWithEntities}
relationship ManyToOne {
One{anotherEnt} to @OnDelete("SET NULL") @OnUpdate("CASCADE") Another,
}`;

const generatorPath = join(__dirname, '../server/index.mjs');
const mockedGenerators = ['jhipster:common', 'jhipster:gradle', 'jhipster:maven'];

describe('generator - app - --incremental-changelog', function () {
  this.timeout(45000);
  const options = {
    creationTimestamp: '2020-01-01',
    incrementalChangelog: true,
    skipClient: true,
    force: true,
    withEntities: true,
  };
  context('when creating a new application', () => {
    let runResult;
    before(async () => {
      runResult = await helpers.run(generatorPath).withJHipsterConfig().withOptions(options).withMockedGenerators(mockedGenerators);
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });

    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/**')).toMatchSnapshot();
    });
  });

  context('when incremental liquibase files exists', () => {
    context('with default options', () => {
      let runResult;
      before(async () => {
        runResult = await helpers
          .create(generatorPath)
          .withOptions(options)
          .doInDir(cwd => {
            incrementalFiles.forEach(filePath => {
              filePath = join(cwd, filePath);
              const dirname = path.dirname(filePath);
              if (!existsSync(dirname)) {
                mkdirSync(dirname, { recursive: true });
              }
              writeFileSync(filePath, basename(filePath));
            });
          })
          .run();
      });

      after(() => runResult.cleanup());

      it('should create application', () => {
        runResult.assertFile(['.yo-rc.json']);
      });

      it('should not override existing incremental files', () => {
        incrementalFiles.forEach(filePath => {
          runResult.assertFileContent(filePath, basename(filePath));
        });
      });

      it('should match snapshot', () => {
        expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/**')).toMatchSnapshot();
      });
    });

    context('with --recreate-initial-changelog', () => {
      let runResult;
      before(async () => {
        runResult = await helpers
          .create(generatorPath)
          .withOptions({ ...options, recreateInitialChangelog: true })
          .doInDir(cwd => {
            incrementalFiles.forEach(filePath => {
              filePath = join(cwd, filePath);
              const dirname = path.dirname(filePath);
              if (!existsSync(dirname)) {
                mkdirSync(dirname, { recursive: true });
              }
              writeFileSync(filePath, basename(filePath));
            });
          })
          .run();
      });

      after(() => runResult.cleanup());

      it('should create application', () => {
        runResult.assertFile(['.yo-rc.json']);
      });

      it('should override existing incremental files', () => {
        incrementalFiles.forEach(filePath => {
          runResult.assertNoFileContent(filePath, filePath);
        });
      });

      it('should match snapshot', () => {
        expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/**')).toMatchSnapshot();
      });
    });
  });

  context('regenerating the application', () => {
    let runResult;
    before(async () => {
      const initialState = createImporterFromContent(jdlApplicationWithRelationshipToUser, {
        ...options,
        skipFileGeneration: true,
        creationTimestampConfig: options.creationTimestamp,
      }).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(2);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();
      const state = createImporterFromContent(jdlApplicationWithRelationshipToUser, {
        skipFileGeneration: true,
        ...options,
      }).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: state.exportedApplicationsWithEntities.JhipsterApp,
          creationTimestamp: '2020-01-02',
        })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'One.json'), join('.jhipster', 'Another.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_One.xml`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000200_added_entity_Another.xml`,
      ]);
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([
        `${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_one.csv`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000200_entity_another.csv`,
      ]);
    });
    it('should not create the entity update changelog', () => {
      runResult.assertNoFile([
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000200_updated_entity_Another.xml`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000200_updated_entity_constraints_Another.xml`,
      ]);
    });

    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/**')).toMatchSnapshot();
    });
  });

  context('when adding a field without constraints', () => {
    let runResult;
    before(async () => {
      const baseName = 'JhipsterApp';
      const initialState = createImporterFromContent(
        `
${jdlApplication}
entity Customer {
    original String
}
`,
        {
          ...options,
          skipFileGeneration: true,
          creationTimestampConfig: options.creationTimestamp,
        }
      ).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(1);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();

      const state = createImporterFromContent(
        `
${jdlApplication}
entity Customer {
    original String
    foo String
}
`,
        {
          skipFileGeneration: true,
          ...options,
        }
      ).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: state.exportedApplicationsWithEntities.JhipsterApp,
          creationTimestamp: '2020-01-02',
        })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'Customer.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_Customer.xml`]);
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_customer.csv`]);
    });
    it('should create entity update changelog with addColumn', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`]);
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'addColumn tableName="customer"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'column name="foo" type="varchar(255)"'
      );
      runResult.assertNoFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'dropColump'
      );
    });
    it('should not create the entity constraint update changelog', () => {
      runResult.assertNoFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_Customer.xml`]);
    });
    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/**')).toMatchSnapshot();
    });
  });

  context('when adding a field with constraints', () => {
    let runResult;
    before(async () => {
      const baseName = 'JhipsterApp';
      const initialState = createImporterFromContent(
        `
${jdlApplication}
entity Customer {
    original String
}
`,
        {
          ...options,
          skipFileGeneration: true,
          creationTimestampConfig: options.creationTimestamp,
        }
      ).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(1);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();

      const regenerateState = createImporterFromContent(
        `
${jdlApplication}
entity Customer {
  original String
  foo String required
}
`,
        {
          skipFileGeneration: true,
          ...options,
        }
      ).import();

      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: regenerateState.exportedApplicationsWithEntities.JhipsterApp,
          creationTimestamp: '2020-01-02',
        })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'Customer.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_Customer.xml`]);
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_customer.csv`]);
    });
    it('should create entity update changelog with addColumn', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`]);
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'addColumn tableName="customer"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'column name="foo" type="varchar(255)"'
      );
      runResult.assertNoFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'dropColump'
      );
    });
    it('should create the entity constraint update changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_Customer.xml`]);
    });
    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/**')).toMatchSnapshot();
    });
  });

  context('when removing a field without constraints', () => {
    let runResult;
    before(async () => {
      const baseName = 'JhipsterApp';
      const initialState = createImporterFromContent(
        `
${jdlApplication}
entity Customer {
    original String
    foo String
}
`,
        {
          ...options,
          skipFileGeneration: true,
          creationTimestampConfig: options.creationTimestamp,
        }
      ).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(1);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();

      const state = createImporterFromContent(
        `
${jdlApplication}
entity Customer {
    original String
}
`,
        {
          skipFileGeneration: true,
          ...options,
        }
      ).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: state.exportedApplicationsWithEntities[baseName],
          creationTimestamp: '2020-01-02',
        })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'Customer.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_Customer.xml`]);
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_customer.csv`]);
    });
    it('should create entity update changelog with dropColumn', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`]);
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'dropColumn tableName="customer"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'column name="foo"'
      );
      runResult.assertNoFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'addColumn'
      );
    });
    it('should not create the entity constraint update changelog', () => {
      runResult.assertNoFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_Customer.xml`]);
    });
    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/**')).toMatchSnapshot();
    });
  });

  context('when removing a field with constraints', () => {
    let runResult;
    before(async () => {
      const baseName = 'JhipsterApp';
      const initialState = createImporterFromContent(
        `
${jdlApplication}
entity Customer {
    original String
    foo String required
}
`,
        {
          ...options,
          skipFileGeneration: true,
          creationTimestampConfig: options.creationTimestamp,
        }
      ).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(1);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();

      const state = createImporterFromContent(
        `
${jdlApplication}
entity Customer {
    original String
}
`,
        {
          skipFileGeneration: true,
          ...options,
        }
      ).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: state.exportedApplicationsWithEntities[baseName],
          creationTimestamp: '2020-01-02',
        })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'Customer.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_Customer.xml`]);
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_customer.csv`]);
    });
    it('should create entity update changelog with dropColumn', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`]);
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'dropColumn tableName="customer"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'column name="foo"'
      );
      runResult.assertNoFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_Customer.xml`,
        'addColumn'
      );
    });
    it('should create the entity constraint update changelog', () => {
      runResult.assertNoFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_Customer.xml`]);
    });
    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/**')).toMatchSnapshot();
    });
  });

  context('when adding a relationship', () => {
    let runResult;
    before(async () => {
      const baseName = 'JhipsterApp';
      const initialState = createImporterFromContent(jdlApplicationWithEntities, {
        ...options,
        skipFileGeneration: true,
        creationTimestampConfig: options.creationTimestamp,
      }).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(2);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();

      const state = createImporterFromContent(jdlApplicationWithEntitiesAndRelationship, {
        skipFileGeneration: true,
        ...options,
      }).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: state.exportedApplicationsWithEntities[baseName],
          creationTimestamp: '2020-01-02',
        })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'One.json'), join('.jhipster', 'Another.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_One.xml`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000200_added_entity_Another.xml`,
      ]);
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_one.csv`]);
    });
    it('should create entity update changelog with addColumn', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`]);
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'addColumn tableName="one"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'column name="another_another_id" type="bigint"'
      );
      runResult.assertNoFileContent(`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`, 'dropColumn');
    });
    it('should create the entity constraint update changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`]);
    });
    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/**')).toMatchSnapshot();
    });
  });
  context('when adding a relationship with on handlers', () => {
    let runResult;
    before(async () => {
      const baseName = 'JhipsterApp';
      const initialState = createImporterFromContent(jdlApplicationWithEntities, {
        ...options,
        skipFileGeneration: true,
        creationTimestampConfig: options.creationTimestamp,
      }).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(2);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();

      const state = createImporterFromContent(jdlApplicationWithEntitiesAndRelationshipsWithOnHandlers, {
        skipFileGeneration: true,
        ...options,
      }).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: state.exportedApplicationsWithEntities[baseName],
          creationTimestamp: '2020-01-02',
        })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'One.json'), join('.jhipster', 'Another.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_One.xml`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000200_added_entity_Another.xml`,
      ]);
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_one.csv`]);
    });
    it('should create entity update changelog with addColumn', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`]);
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'addColumn tableName="one"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'column name="another_another_id" type="bigint"'
      );
      runResult.assertNoFileContent(`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`, 'dropColumn');
    });
    it('should create the entity constraint update changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`]);
    });
    it('should contain onUpdate and onDelete handlers', () => {
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`,
        'onUpdate="SET NULL"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`,
        'onDelete="CASCADE"'
      );
    });
    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/changelog/**')).toMatchSnapshot();
    });
  });
  context('when modifying a relationship with on handlers, only at these handlers', () => {
    let runResult;
    before(async () => {
      const baseName = 'JhipsterApp';
      const initialState = createImporterFromContent(jdlApplicationWithEntities, {
        ...options,
        skipFileGeneration: true,
        creationTimestampConfig: options.creationTimestamp,
      }).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(2);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();

      const state = createImporterFromContent(jdlApplicationWithEntitiesAndRelationshipsWithOnHandlers, {
        skipFileGeneration: true,
        ...options,
      }).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: state.exportedApplicationsWithEntities[baseName],
          creationTimestamp: '2020-01-02',
        })
        .run();

      const thirdState = createImporterFromContent(jdlApplicationWithEntitiesAndRelationshipsWithChangedOnHandlers, {
        skipFileGeneration: true,
        ...options,
      }).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: thirdState.exportedApplicationsWithEntities[baseName],
          creationTimestamp: '2020-01-03',
        })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'One.json'), join('.jhipster', 'Another.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_One.xml`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000200_added_entity_Another.xml`,
      ]);
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_one.csv`]);
    });

    it('should create entity update changelog with addColumn', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`]);
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'addColumn tableName="one"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'column name="another_another_id" type="bigint"'
      );
      runResult.assertNoFileContent(`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`, 'dropColumn');
    });
    it('should create the entity constraint update changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`]);
    });
    it('should contain onUpdate and onDelete handlers', () => {
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`,
        'onUpdate="SET NULL"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`,
        'onDelete="CASCADE"'
      );
    });

    it('should create entity update changelog without add/dropColumn for on handler change', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_One.xml`]);
      runResult.assertNoFileContent(`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_One.xml`, 'addColumn');
      runResult.assertNoFileContent(`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_One.xml`, 'dropColumn');
    });

    it('should create entity update changelog with dropForeignKeyConstraint', () => {
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_One.xml`,
        'dropForeignKeyConstraint'
      );
    });

    it('should create the entity constraint update changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_constraints_One.xml`]);
    });

    it('should contain addForeignKeyConstraint with correct onUpdate and onDelete handlers', () => {
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_constraints_One.xml`,
        'addForeignKeyConstraint'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_constraints_One.xml`,
        'onUpdate="CASCADE"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_constraints_One.xml`,
        'onDelete="SET NULL"'
      );
    });

    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/changelog/**')).toMatchSnapshot();
    });
  });

  context('when modifying an existing relationship', () => {
    let runResult;
    before(async () => {
      const baseName = 'JhipsterApp';
      const initialState = createImporterFromContent(jdlApplicationWithEntities, {
        ...options,
        skipFileGeneration: true,
        creationTimestampConfig: options.creationTimestamp,
      }).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(2);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();

      const state = createImporterFromContent(jdlApplicationWithEntitiesAndRelationshipsWithOnHandlers, {
        skipFileGeneration: true,
        ...options,
      }).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: state.exportedApplicationsWithEntities[baseName],
          creationTimestamp: '2020-01-02',
        })
        .run();

      const thirdState = createImporterFromContent(jdlApplicationWithEntitiesAndRelationshipsWithChangedOnHandlersAndChangedNaming, {
        skipFileGeneration: true,
        ...options,
      }).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: thirdState.exportedApplicationsWithEntities[baseName],
          creationTimestamp: '2020-01-03',
        })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'One.json'), join('.jhipster', 'Another.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_One.xml`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000200_added_entity_Another.xml`,
      ]);
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_one.csv`]);
    });

    it('should create entity update changelog with addColumn', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`]);
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'addColumn tableName="one"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'column name="another_another_id" type="bigint"'
      );
      runResult.assertNoFileContent(`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`, 'dropColumn');
    });
    it('should create the entity constraint update changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`]);
    });
    it('should contain onUpdate and onDelete handlers', () => {
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`,
        'onUpdate="SET NULL"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`,
        'onDelete="CASCADE"'
      );
    });

    it('should create entity update changelog with add/dropColumn for on handler change', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_One.xml`]);

      runResult.assertFileContent(`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_One.xml`, 'addColumn');
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_One.xml`,
        'column name="another_ent_another_id" type="bigint"'
      );

      runResult.assertFileContent(`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_One.xml`, 'dropColumn');
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_One.xml`,
        'column name="another_another_id"'
      );
    });

    it('should create entity update changelog with dropForeignKeyConstraint', () => {
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_One.xml`,
        'dropForeignKeyConstraint'
      );
    });

    it('should create the entity constraint update changelog', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_constraints_One.xml`]);
    });

    it('should contain addForeignKeyConstraint with correct onUpdate and onDelete handlers', () => {
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_constraints_One.xml`,
        'addForeignKeyConstraint'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_constraints_One.xml`,
        'onUpdate="CASCADE"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200103000100_updated_entity_constraints_One.xml`,
        'onDelete="SET NULL"'
      );
    });

    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/changelog/**')).toMatchSnapshot();
    });
  });

  context('when initially creating an application with entities with relationships having on handlers', () => {
    let runResult;
    before(async () => {
      const baseName = 'JhipsterApp';
      const initialState = createImporterFromContent(jdlApplicationWithEntitiesAndRelationshipsWithOnHandlers, {
        ...options,
        skipFileGeneration: true,
        creationTimestampConfig: options.creationTimestamp,
      }).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(2);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'One.json'), join('.jhipster', 'Another.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_One.xml`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000200_added_entity_Another.xml`,
      ]);
    });
    it('should have a foreign key column in initial changelog', () => {
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_One.xml`,
        'column name="another_another_id" type="bigint"'
      );
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_one.csv`]);
    });
    it('should create entity initial constraint changelog with addForeignKeyConstraint and proper on handlers', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_constraints_One.xml`]);

      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_constraints_One.xml`,
        'addForeignKeyConstraint'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_constraints_One.xml`,
        'onUpdate="SET NULL"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_constraints_One.xml`,
        'onDelete="CASCADE"'
      );
    });

    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/changelog/**')).toMatchSnapshot();
    });
  });

  context('when removing a relationship', () => {
    let runResult;
    before(async () => {
      const baseName = 'JhipsterApp';
      const initialState = createImporterFromContent(jdlApplicationWithEntitiesAndRelationship, {
        ...options,
        skipFileGeneration: true,
        creationTimestampConfig: options.creationTimestamp,
      }).import();
      const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
      expect(applicationWithEntities).toBeTruthy();
      expect(applicationWithEntities.entities.length).toBe(2);
      runResult = await helpers
        .create(generatorPath)
        .withOptions({ ...options, applicationWithEntities })
        .run();

      const state = createImporterFromContent(jdlApplicationWithEntities, {
        skipFileGeneration: true,
        ...options,
      }).import();
      runResult = await runResult
        .create(generatorPath)
        .withOptions({
          ...options,
          applicationWithEntities: state.exportedApplicationsWithEntities[baseName],
          creationTimestamp: '2020-01-02',
        })
        .run();
    });

    after(() => runResult.cleanup());

    it('should create application', () => {
      runResult.assertFile(['.yo-rc.json']);
    });
    it('should create entity config file', () => {
      runResult.assertFile([join('.jhipster', 'One.json'), join('.jhipster', 'Another.json')]);
    });
    it('should create entity initial changelog', () => {
      runResult.assertFile([
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000100_added_entity_One.xml`,
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200101000200_added_entity_Another.xml`,
      ]);
    });
    it('should create entity initial fake data', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_one.csv`]);
    });
    it('should create entity update changelog with dropColumn and dropForeignKeyContraint', () => {
      runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`]);
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'dropColumn tableName="one"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'column name="another_another_id"'
      );
      runResult.assertFileContent(
        `${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_One.xml`,
        'dropForeignKeyConstraint baseTableName="one" constraintName="fk_one__another_id"'
      );
    });
    it('should not create an additional entity constraint update changelog', () => {
      runResult.assertNoFile([`${SERVER_MAIN_RES_DIR}config/liquibase/changelog/20200102000100_updated_entity_constraints_One.xml`]);
    });
    it('should match snapshot', () => {
      expect(runResult.getSnapshot('**/src/main/resources/config/liquibase/**')).toMatchSnapshot();
    });
  });

  context('entities with/without byte fields should create fake data', () => {
    [
      {
        entity: jdlApplicationEntitieWithByteTypes,
        bytesFields: true,
        testContent:
          '1;geez;1369;../fake-data/blob/hipster.txt;../fake-data/blob/hipster.png;image/png;../fake-data/blob/hipster.png;image/png;Laptop;5650',
        contentRequired: true,
      },
      {
        entity: jdlApplicationEntitieWithoutByteTypes,
        bytesFields: false,
        testContent: 'content_type',
        contentRequired: false,
      },
    ].forEach(eachEntityConfig => {
      describe(`testing ${eachEntityConfig.bytesFields ? 'with' : 'without'} byte fields`, () => {
        let runResult;
        before(async () => {
          const baseName = 'JhipsterApp';
          const initialState = createImporterFromContent(eachEntityConfig.entity, {
            ...options,
            skipFileGeneration: true,
            creationTimestampConfig: options.creationTimestamp,
          }).import();
          const applicationWithEntities = initialState.exportedApplicationsWithEntities[baseName];
          expect(applicationWithEntities).toBeTruthy();
          expect(applicationWithEntities.entities.length).toBe(1);
          runResult = await helpers
            .create(generatorPath)
            .withOptions({ ...options, applicationWithEntities })
            .run();
        });

        it('should create entity config file', () => {
          runResult.assertFile([join('.jhipster', 'Smarty.json')]);
        });
        it('should create entity initial fake data file', () => {
          runResult.assertFile([`${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_smarty.csv`]);
        });
        it('should create fake data file with required content', () => {
          eachEntityConfig.contentRequired
            ? runResult.assertFileContent(
                `${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_smarty.csv`,
                eachEntityConfig.testContent
              )
            : runResult.assertNoFileContent(
                `${SERVER_MAIN_RES_DIR}config/liquibase/fake-data/20200101000100_entity_smarty.csv`,
                eachEntityConfig.testContent
              );
        });
      });
    });
  });
});
