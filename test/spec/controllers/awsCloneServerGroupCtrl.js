'use strict';

describe('Controller: awsCloneServerGroup', function () {

  beforeEach(loadDeckWithoutCacheInitializer);

  beforeEach(function() {
    inject(function ($controller, $rootScope, accountService, orcaService, mortService, oortService,
                     searchService, instanceTypeService, modalWizardService, securityGroupService, taskMonitorService, $q) {

      this.$scope = $rootScope.$new();
      this.accountService = accountService;
      this.orcaService = orcaService;
      this.mortService = mortService;
      this.oortService = oortService;
      this.searchService = searchService;
      this.instanceTypeService = instanceTypeService;
      this.modalWizardService = modalWizardService;
      this.securityGroupService = securityGroupService;
      this.taskMonitorService = taskMonitorService;
      this.$q = $q;
    });

    this.modalInstance = {
      result: {
        then: angular.noop
      }
    };

    var spec = this;
    this.resolve = function(result) {
      return function() { return spec.$q.when(result); };
    };

    this.buildBaseClone = function() {
      return {
        account: 'prod',
        region: 'us-west-1',
        asg: {
          availabilityZones: ['g','h','i'],
          autoScalingGroupName: 'testasg-v002',
          vpczoneIdentifier: ''
        },
        launchConfig: {
          imageId: 'ami-123',
          instanceMonitoring: {
            enabled: true
          },
          securityGroups: []
        }
      };
    }
  });

  describe('preferred zone handling', function() {
    function initController(serverGroup) {
      inject(function ($controller) {
        this.ctrl = $controller('awsCloneServerGroupCtrl', {
          $scope: this.$scope,
          $modalInstance: this.modalInstance,
          accountService: this.accountService,
          orcaService: this.orcaService,
          mortService: this.mortService,
          oortService: this.oortService,
          searchService: this.searchService,
          instanceTypeService: this.instanceTypeService,
          modalWizardService: this.modalWizardService,
          securityGroupService: this.securityGroupService,
          taskMonitorService: this.taskMonitorService,
          serverGroup: serverGroup,
          application: {name: 'x'},
          title: 'n/a'
        });
      });
    }

    function setupMocks() {
      var resolve = this.resolve;

      this.wizard = jasmine.createSpyObj('wizard', ['markDirty', 'markComplete']);
      spyOn(this.accountService, 'getPreferredZonesByAccount').andCallFake(resolve(AccountServiceFixture.preferredZonesByAccount));
      spyOn(this.accountService, 'getRegionsKeyedByAccount').andCallFake(resolve(AccountServiceFixture.regionsKeyedByAccount));
      spyOn(this.mortService, 'listSubnets').andCallFake(resolve([]));
      spyOn(this.mortService, 'listKeyPairs').andCallFake(resolve([]));
      spyOn(this.securityGroupService, 'getAllSecurityGroups').andCallFake(resolve(SecurityGroupServiceFixture.allSecurityGroups));
      spyOn(this.oortService, 'listLoadBalancers').andCallFake(resolve([]));
      spyOn(this.oortService, 'findImages').andCallFake(resolve([{amis: {'us-east-1': []}}]));

      spyOn(this.searchService, 'search').andCallFake(resolve({results: []}));
      spyOn(this.modalWizardService, 'getWizard').andReturn(this.wizard);

      spyOn(this.instanceTypeService, 'getAvailableTypesForRegions').andCallFake(resolve([]));
    }

    it('initializes to default values, setting usePreferredZone flag to true', function () {
      var $scope = this.$scope;
      setupMocks.bind(this).call();

      initController();

      $scope.$digest();

      expect($scope.command.usePreferredZones).toBe(true);
      expect($scope.command.availabilityZones).toEqual(['a', 'b', 'c']);
    });

    it('sets usePreferredZones flag based on initial value', function() {
      var $scope = this.$scope;
      setupMocks.bind(this).call();

      var serverGroup = this.buildBaseClone();

      initController(serverGroup);

      $scope.$digest();

      expect($scope.command.usePreferredZones).toBe(true);
      expect($scope.command.availabilityZones).toEqual(['g', 'h', 'i']);

      serverGroup.asg.availabilityZones = ['g'];
      initController(serverGroup);

      $scope.$digest();

      expect($scope.command.usePreferredZones).toBe(false);
      expect($scope.command.availabilityZones).toEqual(['g']);

    });

    it('updates to default values when credentials changed', function() {
      var $scope = this.$scope;
      setupMocks.bind(this).call();

      initController();

      $scope.$digest();

      $scope.command.credentials = 'prod';
      $scope.$digest();

      expect($scope.command.availabilityZones).toEqual(['d', 'e']);
    });

    it('updates to default values when region changed', function() {
      var $scope = this.$scope;
      setupMocks.bind(this).call();

      initController();

      $scope.$digest();

      $scope.command.region = 'us-west-1';
      $scope.$digest();

      expect($scope.command.usePreferredZones).toBe(true);
      expect($scope.command.availabilityZones).toEqual(['c', 'd']);
      expect(this.wizard.markDirty.calls.length).toBe(0);
    });

    it('clears availability zones when region changed and not using preferred values', function() {
      var $scope = this.$scope;
      setupMocks.bind(this).call();

      initController();

      $scope.$digest();

      expect($scope.command.availabilityZones).toEqual(['a','b','c']);

      $scope.command.region = 'us-west-1';
      $scope.command.usePreferredZones = false;
      $scope.$digest();

      expect($scope.command.usePreferredZones).toBe(false);
      expect($scope.command.availabilityZones).toEqual(['b','c']);
      expect(this.wizard.markDirty.calls.length).toBe(1);
    });

    it('sets/clears availability zones to preferred zones when toggled on/off', function() {
      var $scope = this.$scope;
      setupMocks.bind(this).call();

      initController();

      $scope.$digest();

      expect($scope.command.availabilityZones).toEqual(['a','b','c']);
      expect($scope.command.usePreferredZones).toBe(true);

      $scope.command.usePreferredZones = false;
      $scope.$digest();

      expect($scope.command.availabilityZones).toEqual(['a','b','c']);
      expect($scope.command.usePreferredZones).toBe(false);

      $scope.command.availabilityZones = [];
      $scope.command.usePreferredZones = true;

      $scope.$digest();

      expect($scope.command.availabilityZones).toEqual(['a','b','c']);
      expect($scope.command.usePreferredZones).toBe(true);
    });
  });

  describe('image loading', function() {
    function initController(serverGroup) {
      inject(function ($controller) {
        this.ctrl = $controller('awsCloneServerGroupCtrl', {
          $scope: this.$scope,
          $modalInstance: this.modalInstance,
          accountService: this.accountService,
          orcaService: this.orcaService,
          mortService: this.mortService,
          oortService: this.oortService,
          searchService: this.searchService,
          instanceTypeService: this.instanceTypeService,
          modalWizardService: this.modalWizardService,
          securityGroupService: this.securityGroupService,
          taskMonitorService: this.taskMonitorService,
          serverGroup: serverGroup,
          application: {name: 'x'},
          title: 'n/a'
        });
      });
    }

    function setupMocks() {
      var resolve = this.resolve;

      this.wizard = jasmine.createSpyObj('wizard', ['markDirty', 'markComplete']);
      spyOn(this.accountService, 'getPreferredZonesByAccount').andCallFake(resolve(AccountServiceFixture.preferredZonesByAccount));
      spyOn(this.accountService, 'getRegionsKeyedByAccount').andCallFake(resolve(AccountServiceFixture.regionsKeyedByAccount));
      spyOn(this.mortService, 'listSubnets').andCallFake(resolve([]));
      spyOn(this.mortService, 'listKeyPairs').andCallFake(resolve([]));
      spyOn(this.securityGroupService, 'getAllSecurityGroups').andCallFake(resolve(SecurityGroupServiceFixture.allSecurityGroups));
      spyOn(this.oortService, 'listLoadBalancers').andCallFake(resolve([]));

      spyOn(this.searchService, 'search').andCallFake(resolve({results: []}));
      spyOn(this.modalWizardService, 'getWizard').andReturn(this.wizard);

      spyOn(this.instanceTypeService, 'getAvailableTypesForRegions').andCallFake(resolve([]));
    }

    it('sets state flags for imagesLoaded and queryAllImages when none found and no server group provided', function() {
      var $scope = this.$scope;
      setupMocks.bind(this).call();

      spyOn(this.oortService, 'findImages').andCallFake(this.resolve([]));

      initController();

      $scope.$digest();

      expect($scope.state.imagesLoaded).toBe(true);
      expect($scope.state.queryAllImages).toBe(true);
    });

    it('sets state flag for imagesLoaded and puts found images on scope when found', function() {
      var $scope = this.$scope,
          regionalImages = [{amis: {'us-east-1': []}}];
      setupMocks.bind(this).call();

      spyOn(this.oortService, 'findImages').andCallFake(this.resolve(regionalImages));

      initController();

      $scope.$digest();

      expect($scope.state.imagesLoaded).toBe(true);
      expect($scope.state.queryAllImages).toBe(false);
      expect($scope.regionalImages).toEqual(regionalImages);
    });

    it('queries based on existing ami when none found for the application', function() {
      var context = this,
          $scope = this.$scope,
          amiBasedImage = {imageName: 'something-packagebase', amis: {'us-east-1': ['ami-1234']}},
          packageBasedImages = [{imageName: 'something-packagebase', amis: {'us-east-1': ['ami-1234']}}],
          serverGroup = {
            launchConfig: {
              imageId: 'ami-1234',
              securityGroups: [],
              instanceMonitoring: {}
            },
            region: 'us-east-1',
            account: 'test',
            asg: {
              availabilityZones: [],
              vpczoneIdentifier: ''
            }
          };
      setupMocks.bind(this).call();

      spyOn(this.oortService, 'findImages').andCallFake(function(query) {
        if (query === 'something') {
          return context.resolve(packageBasedImages).call();
        } else {
          return context.resolve([]).call();
        }
      });

      spyOn(this.oortService, 'getAmi').andCallFake(this.resolve(amiBasedImage));

      initController(serverGroup);

      $scope.$digest();

      expect($scope.state.imagesLoaded).toBe(true);
      expect($scope.state.queryAllImages).toBe(false);
      expect(this.oortService.getAmi).toHaveBeenCalledWith(serverGroup.launchConfig.imageId, serverGroup.region, serverGroup.account);
      expect(this.oortService.findImages).toHaveBeenCalledWith($scope.applicationName, serverGroup.region, serverGroup.account);
      expect(this.oortService.findImages).toHaveBeenCalledWith('something', serverGroup.region, serverGroup.account);
      expect($scope.regionalImages).toEqual(packageBasedImages);
    });

    it('adds no regional images to the scope when the one provided does not match any results', function() {
      var $scope = this.$scope,
          serverGroup = this.buildBaseClone();
      setupMocks.bind(this).call();

      spyOn(this.oortService, 'findImages').andCallFake(this.resolve([]));
      spyOn(this.oortService, 'getAmi').andCallFake(this.resolve(null));

      initController(serverGroup);

      $scope.$digest();

      expect($scope.state.imagesLoaded).toBe(true);
      expect($scope.state.queryAllImages).toBe(true);
      expect(this.oortService.getAmi).toHaveBeenCalledWith(serverGroup.launchConfig.imageId, serverGroup.region, serverGroup.account);
      expect(this.oortService.findImages).toHaveBeenCalledWith($scope.applicationName, serverGroup.region, serverGroup.account);
      expect($scope.regionalImages).toEqual([]);
    });

    it('queries all images for ami when no regional images present', function() {
      var $scope = this.$scope;

      setupMocks.bind(this).call();

      spyOn(this.oortService, 'findImages').andCallFake(this.resolve([]));
      spyOn(this.oortService, 'getAmi').andCallFake(this.resolve(null));

      initController();

      $scope.$digest();

      expect($scope.state.imagesLoaded).toBe(true);
      expect(this.ctrl.useAllImageSelection()).toBe(true);
    });

    it('queries all images for ami when specified by user', function() {
      var $scope = this.$scope;

      setupMocks.bind(this).call();

      spyOn(this.oortService, 'findImages').andCallFake(this.resolve([{imageName: 'something-packagebase', amis: {'us-east-1': ['ami-1234']}}]));
      spyOn(this.oortService, 'getAmi').andCallFake(this.resolve(null));

      initController();

      $scope.$digest();
      expect($scope.state.imagesLoaded).toBe(true);
      expect(this.ctrl.useAllImageSelection()).toBe(false);

      $scope.state.queryAllImages = true;
      $scope.$digest();
      expect(this.ctrl.useAllImageSelection()).toBe(true);

      $scope.state.queryAllImages = false;
      $scope.$digest();
      expect(this.ctrl.useAllImageSelection()).toBe(false);

    });
  });

  describe('command submit', function() {
    function initController(serverGroup) {
      inject(function ($controller) {
        this.ctrl = $controller('awsCloneServerGroupCtrl', {
          $scope: this.$scope,
          $modalInstance: this.modalInstance,
          accountService: this.accountService,
          orcaService: this.orcaService,
          mortService: this.mortService,
          oortService: this.oortService,
          searchService: this.searchService,
          instanceTypeService: this.instanceTypeService,
          modalWizardService: this.modalWizardService,
          securityGroupService: this.securityGroupService,
          taskMonitorService: this.taskMonitorService,
          serverGroup: serverGroup,
          application: {name: 'x'},
          title: 'n/a'
        });
      });
    }

    function setupMocks() {
      var resolve = this.resolve,
          spec = this;

      this.wizard = jasmine.createSpyObj('wizard', ['markDirty', 'markComplete']);
      spyOn(this.accountService, 'getPreferredZonesByAccount').andCallFake(resolve(AccountServiceFixture.preferredZonesByAccount));
      spyOn(this.accountService, 'getRegionsKeyedByAccount').andCallFake(resolve(AccountServiceFixture.regionsKeyedByAccount));
      spyOn(this.mortService, 'listSubnets').andCallFake(resolve([]));
      spyOn(this.mortService, 'listKeyPairs').andCallFake(resolve([]));
      spyOn(this.securityGroupService, 'getAllSecurityGroups').andCallFake(resolve(SecurityGroupServiceFixture.allSecurityGroups));
      spyOn(this.oortService, 'listLoadBalancers').andCallFake(resolve([]));

      spyOn(this.searchService, 'search').andCallFake(resolve({results: []}));
      spyOn(this.modalWizardService, 'getWizard').andReturn(this.wizard);

      spyOn(this.instanceTypeService, 'getAvailableTypesForRegions').andCallFake(resolve([]));
      spyOn(this.oortService, 'findImages').andCallFake(this.resolve([]));
      spyOn(this.oortService, 'getAmi').andCallFake(this.resolve(null));

      spyOn(this.orcaService, 'cloneServerGroup').andCallFake(function(command, applicationName, description) {
        spec.submitted = {
          command: command,
          applicationName: applicationName,
          description: description
        }
      });

    }

    it('sets amiName from allImageSelection', function() {
      var $scope = this.$scope;

      setupMocks.bind(this).call();

      initController();

      spyOn(this.$scope.taskMonitor, 'submit').andCallFake(function(method) {
        method.call();
      });

      $scope.command.allImageSelection = 'something-packagebase';

      this.ctrl.clone();
      $scope.$digest();

      var command = this.submitted.command;

      expect(command.amiName).toBe('something-packagebase');

    });

    it('removes subnetType property when null', function() {
      var $scope = this.$scope;

      setupMocks.bind(this).call();

      initController();

      spyOn(this.$scope.taskMonitor, 'submit').andCallFake(function(method) {
        method.call();
      });

      this.ctrl.clone();
      $scope.$digest();

      expect(this.submitted.command.subnetType).toBe(undefined);

      $scope.command.subnetType = 'internal';

      this.ctrl.clone();
      $scope.$digest();

      expect(this.submitted.command.subnetType).toBe('internal');
    });

    it('sets action type and description appropriately when creating new', function() {
      var $scope = this.$scope,
          command = $scope.command;

      setupMocks.bind(this).call();

      initController();

      spyOn(this.$scope.taskMonitor, 'submit').andCallFake(function(method) {
        method.call();
      });

      this.ctrl.clone();
      $scope.$digest();

      expect(this.submitted.command.type).toBe('deploy');
      expect(this.submitted.description).toBe('Create New Server Group in cluster x');

      $scope.command.stack = 'main';
      this.ctrl.clone();
      $scope.$digest();

      expect(this.submitted.description).toBe('Create New Server Group in cluster x-main');

      $scope.command.freeFormDetails = 'details';
      this.ctrl.clone();
      $scope.$digest();

      expect(this.submitted.description).toBe('Create New Server Group in cluster x-main-details');

      delete $scope.command.stack;
      this.ctrl.clone();
      $scope.$digest();

      expect(this.submitted.description).toBe('Create New Server Group in cluster x--details');
    });

    it('sets action type and description appropriately when cloning', function() {
      var $scope = this.$scope,
          serverGroup = this.buildBaseClone();

      setupMocks.bind(this).call();

      initController(serverGroup);

      spyOn(this.$scope.taskMonitor, 'submit').andCallFake(function(method) {
        method.call();
      });

      this.ctrl.clone();
      $scope.$digest();

      expect(this.submitted.command.type).toBe('copyLastAsg');
      expect(this.submitted.description).toBe('Create Cloned Server Group from testasg-v002');
    });
  });

});
